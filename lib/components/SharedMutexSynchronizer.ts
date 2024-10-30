import { EventEmitter } from 'events'
import cluster from '../utils/cluster'
import { LocalLockItem, LockItemInfo } from '../utils/interfaces'
import { sanitizeLock, keysRelatedMatch } from '../utils/utils'
import { ACTION, DEBUG_INFO_REPORTS, ERROR, MASTER_ID, SYNC_EVENTS } from '../utils/constants'
import { MutexError } from '../utils/MutexError'
import { MutexGlobalStorage } from './MutexGlobalStorage'
import version from '../utils/version'
import { SharedMutexConfigManager } from './SharedMutexConfigManager'

/**********************************
 *
 * cluster synchronizer
 *
 ***********************************/
export class SharedMutexSynchronizer {
  /**
   * Report debug info, you can use console log inside to track, whats going on
   */
  static reportDebugInfo: (state: string, item: LocalLockItem, codeStack?: string) => void

  /**
   * Report debug info with stack
   */
  static debugWithStack: boolean = false

  /**
   * configuration checked
   */
  protected static usingCustomConfiguration: boolean

  /**
   * Handlers for master process to work
   * with mutexes
   */
  static readonly masterHandler: {
    masterIncomingMessage: (message: any) => void
    emitter: EventEmitter
  } = {
    masterIncomingMessage: null,
    emitter: new EventEmitter(),
  }

  /**
   * Timeout handler, for handling if lock was freezed for too long time
   * You can set this handler to your own, to make decision what to do in this case
   * You can use methods like getLockInfo or resetLockTimeout to get info and deal with this situation
   * Default behaviour is to log it, if it's on master, it will throws error. If it's fork, it will kill it.
   * @param hash
   */
  static timeoutHandler: (hash: string) => void = (hash: string) => {
    const info = SharedMutexSynchronizer.getLockInfo(hash)
    if (!info) {
      return // this lock does not exsists
    }

    // debug info
    if (SharedMutexSynchronizer.reportDebugInfo) {
      SharedMutexSynchronizer.reportDebugInfo(
        DEBUG_INFO_REPORTS.LOCK_TIMEOUT,
        MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash),
      )
    }

    console.error(ERROR.MUTEX_LOCK_TIMEOUT, info)
    if (info.workerId === MASTER_ID) {
      throw new MutexError(ERROR.MUTEX_LOCK_TIMEOUT)
    } else {
      process.kill(cluster.workers?.[info.workerId]?.process.pid, 9)
    }
  }

  /**
   * Get info about lock by hash
   * @param hash
   * @returns
   */
  static getLockInfo(hash: string): LockItemInfo {
    const queue = MutexGlobalStorage.getLocalLocksQueue()
    const item = queue.find(i => i.hash === hash)
    const blockedBy = queue.filter(l => l.isRunning && keysRelatedMatch(l.key, item.key)).filter(l => l.hash !== hash)
    if (item) {
      return {
        workerId: item.workerId,
        singleAccess: item.singleAccess,
        hash: item.hash,
        key: item.key,
        isRunning: item.isRunning,
        codeStack: item.codeStack,
        blockedBy,
        reportedPhases: item.reportedPhases,
      }
    }
  }

  /**
   * Reset watchdog for lock
   * @param hash
   * @returns
   */
  static resetLockTimeout(hash: string, newMaxLockingTime?: number) {
    const item = MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash)
    if (item) {
      if (typeof newMaxLockingTime === 'number') {
        item.maxLockingTime = newMaxLockingTime
      }
      if (item.timeout) {
        clearTimeout(item.timeout)
      }
      if (item.maxLockingTime) {
        item.timeout = setTimeout(() => SharedMutexSynchronizer.lockTimeout(hash), item.maxLockingTime)
      }
    }
  }

  /**
   * Initialize master handler
   */
  static async initializeMaster() {
    // skip double init
    if (MutexGlobalStorage.getInitialized() || !cluster.isMaster) {
      return
    }

    // already initialized
    MutexGlobalStorage.setInitialized()

    // if we are using clusters at all
    if (cluster && typeof cluster.on === 'function') {
      ;(await SharedMutexConfigManager.getComm()).onClusterMessage(SharedMutexSynchronizer.handleClusterMessage)

      cluster.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id))
    }

    // setup functions for master
    SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage
  }

  /**
   * Get count of locks currently
   * @returns
   */
  static getLocksCount(): number {
    return MutexGlobalStorage.getLocalLocksQueue().length
  }

  /**
   * Lock mutex
   */
  protected static lock(item: LocalLockItem, codeStack?: string) {
    // add it to locks
    const nItem = { ...item, codeStack }
    MutexGlobalStorage.getLocalLocksQueue().push(nItem)

    // set timeout if provided
    if (nItem.maxLockingTime) {
      nItem.timeout = setTimeout(() => SharedMutexSynchronizer.lockTimeout(nItem.hash), nItem.maxLockingTime)
    }

    // debug info
    if (SharedMutexSynchronizer.reportDebugInfo) {
      SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_WAITING, nItem, codeStack)
    }

    // next tick... unlock something, if waiting
    SharedMutexSynchronizer.mutexTickNext()
  }

  /**
   * Unlock handler
   * @param key
   * @param workerId
   */
  protected static unlock(hash?: string, codeStack?: string) {
    const f = MutexGlobalStorage.getLocalLocksQueue().find(foundItem => foundItem.hash === hash)
    if (!f) {
      return
    }

    // clear timeout, if exists
    if (f.timeout) {
      clearTimeout(f.timeout)
    }

    // report debug info
    if (SharedMutexSynchronizer.reportDebugInfo) {
      SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_EXIT, f, codeStack)
    }

    // remove from queue
    MutexGlobalStorage.setLocalLocksQueue(MutexGlobalStorage.getLocalLocksQueue().filter(item => item.hash !== hash))

    // next tick... unlock something, if waiting
    SharedMutexSynchronizer.mutexTickNext()
  }

  /**
   * Tick of mutex run, it will continue next mutex(es) in queue
   */
  protected static mutexTickNext() {
    const queue = MutexGlobalStorage.getLocalLocksQueue()
    const changes: string[] = []

    SharedMutexSynchronizer.solveGroup(queue, changes)

    for (const hash of changes) {
      SharedMutexSynchronizer.continue(hash)
    }
    if (changes.length) {
      SharedMutexSynchronizer.mutexTickNext()
    }
  }

  protected static solveGroup(queue: LocalLockItem[], changes: string[]) {
    for (let i = 0; i < queue.length; i++) {
      const lock = queue[i]
      if (lock.isRunning) {
        continue
      }

      const foundRunningLocks = queue.filter(l => l.isRunning && keysRelatedMatch(l.key, lock.key))

      // if single access group is on top, break it anyway
      if (lock.singleAccess) {
        // if nothing is running or running is my parent
        const isParentTreeRunning =
          lock.parents && foundRunningLocks.length === lock.parents.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash))

        if (foundRunningLocks.length === 0 || isParentTreeRunning) {
          changes.push(lock.hash)
          lock.isRunning = true
        }
      } else {
        const isParentTreeRunning =
          lock.parents && foundRunningLocks.length === lock.parents.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash))

        if (foundRunningLocks.every(lock => !lock.singleAccess) || isParentTreeRunning) {
          changes.push(lock.hash)
          lock.isRunning = true
        }
      }
    }
  }

  /**
   * Continue worker in queue
   * @param key
   */
  protected static continue(hash: string, originalStack?: string) {
    const item = MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash)
    item.isRunning = true

    // report debug info
    if (SharedMutexSynchronizer.reportDebugInfo) {
      SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_CONTINUE, item, originalStack)
    }

    const message = {
      action: ACTION.CONTINUE,
      hash: item.hash,
    }

    // emit it
    SharedMutexSynchronizer.masterHandler.emitter.emit('message', message)
    Object.keys(cluster.workers).forEach(workerId => SharedMutexSynchronizer.send(cluster.workers?.[workerId], message))
  }

  /**
   * Handle incomming message from whole cluster
   */
  protected static handleClusterMessage(worker: any, message: any) {
    SharedMutexSynchronizer.masterIncomingMessage(message, worker)
  }

  /**
   * Handle master incomming message
   * @param message
   */
  protected static masterIncomingMessage(message: any, worker?: any) {
    if (!message.action) {
      return
    }

    // lock
    if (message.action === ACTION.LOCK) {
      SharedMutexSynchronizer.lock(sanitizeLock(message), message.codeStack)
      // unlock
    } else if (message.action === ACTION.UNLOCK) {
      SharedMutexSynchronizer.unlock(message.hash, message.codeStack)
      // verify master handler
    } else if (message.action === ACTION.WATCHDOG_REPORT) {
      SharedMutexSynchronizer.watchdogResponse(message.hash, message.phase, message.codeStack, message.args)
      // unlock
    } else if (message.action === ACTION.VERIFY) {
      // check if somebody overrided default config
      if (typeof SharedMutexSynchronizer.usingCustomConfiguration === 'undefined') {
        SharedMutexSynchronizer.usingCustomConfiguration = message.usingCustomConfig
      } else if (SharedMutexSynchronizer.usingCustomConfiguration !== message.usingCustomConfig) {
        // and if somebody changed it and somebody not, it should crash with it
        throw new MutexError(
          ERROR.MUTEX_CUSTOM_CONFIGURATION,
          'This is usually caused by setting custom configuration by calling initialize({...}) only in some of forks, or only in master. You need to call it everywhere with same (*or compatible) config.',
        )
      }

      SharedMutexSynchronizer.send(worker, {
        action: ACTION.VERIFY_COMPLETE,
        version,
      })
    }
  }

  /**
   * Push phase to lock
   */
  protected static watchdogResponse(hash: string, phase?: string, codeStack?: string, args?: any) {
    const item = MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash)
    const message = {
      action: ACTION.WATCHDOG_STATUS,
      hash: hash,
      status: item ? item.status : 'timeouted',
    }

    if (item) {
      if (phase) {
        if (!item.reportedPhases) {
          item.reportedPhases = []
        }
        item.reportedPhases.push({ phase, codeStack, args })
      }
      SharedMutexSynchronizer.send(cluster.workers[item.workerId], message)
    }

    SharedMutexSynchronizer.masterHandler.emitter.emit('message', message)
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  protected static workerUnlockForced(workerId: number) {
    MutexGlobalStorage.getLocalLocksQueue()
      .filter(i => i.workerId === workerId)
      .forEach(i => SharedMutexSynchronizer.unlock(i.hash))
  }

  /**
   * Send message to worker
   */
  protected static async send(worker: any, message: any) {
    ;(await SharedMutexConfigManager.getComm()).workerSend(worker, message)
  }

  /**
   * Lock timeout handler
   */
  protected static lockTimeout = (hash: string) => {
    const item = MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash)
    if (item) {
      item.status = 'timeouted'
      SharedMutexSynchronizer.watchdogResponse(hash)
    }
    SharedMutexSynchronizer.timeoutHandler(hash)

    // send continue with rejection
    const message = {
      action: ACTION.CONTINUE,
      hash: item.hash,
      rejected: true,
    }
    SharedMutexSynchronizer.masterHandler.emitter.emit('message', message)
    SharedMutexSynchronizer.send(cluster.workers?.[item.workerId], message)

    SharedMutexSynchronizer.unlock(hash)
  }
}
