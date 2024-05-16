import { EventEmitter } from 'events'
import cluster from '../utils/cluster'
import { LocalLockItem, LockDescriptor } from '../utils/interfaces'
import { SecondarySynchronizer } from './SecondarySynchronizer'
import { keysRelatedMatch, sanitizeLock } from '../utils/utils'
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
  static reportDebugInfo = (state: string, item: LocalLockItem, codeStack?: string) => {}

  /**
   * Report debug info with stack
   */
  static debugWithStack: boolean = false

  /**
   * secondary arbitter
   */
  protected static secondarySynchronizer: SecondarySynchronizer = null

  /**
   * configuration checked
   */
  protected static usingCustomConfiguration: boolean

  /**
   * Setup secondary synchronizer - prepared for mesh
   */
  static setSecondarySynchronizer(secondarySynchronizer: SecondarySynchronizer) {
    SharedMutexSynchronizer.secondarySynchronizer = secondarySynchronizer
    SharedMutexSynchronizer.secondarySynchronizer.on(SYNC_EVENTS.LOCK, SharedMutexSynchronizer.lock)
    SharedMutexSynchronizer.secondarySynchronizer.on(SYNC_EVENTS.UNLOCK, SharedMutexSynchronizer.unlock)
    SharedMutexSynchronizer.secondarySynchronizer.on(SYNC_EVENTS.CONTINUE, SharedMutexSynchronizer.continue)
  }

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
    SharedMutexSynchronizer.reportDebugInfo(
      DEBUG_INFO_REPORTS.LOCK_TIMEOUT,
      MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash),
    )

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
  static getLockInfo(hash: string): LockDescriptor {
    const item = MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash)
    if (item) {
      return {
        workerId: item.workerId,
        singleAccess: item.singleAccess,
        hash: item.hash,
        key: item.key,
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
        item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(hash), item.maxLockingTime)
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
    const nItem = { ...item }
    MutexGlobalStorage.getLocalLocksQueue().push(nItem)

    // set timeout if provided
    if (nItem.maxLockingTime) {
      nItem.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(nItem.hash), nItem.maxLockingTime)
    }

    // send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.lock(nItem)
    }

    // debug info
    SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_WAITING, nItem, codeStack)

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
    SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_EXIT, f, codeStack)

    // remove from queue
    MutexGlobalStorage.setLocalLocksQueue(MutexGlobalStorage.getLocalLocksQueue().filter(item => item.hash !== hash))

    // send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.unlock(hash)
    }

    // next tick... unlock something, if waiting
    SharedMutexSynchronizer.mutexTickNext()
  }

  /**
   * Tick of mutex run, it will continue next mutex(es) in queue
   */
  protected static mutexTickNext() {
    // if we have secondary sync. and we are not arbitter
    if (SharedMutexSynchronizer.secondarySynchronizer && !SharedMutexSynchronizer.secondarySynchronizer?.isArbitter) {
      return
    }

    const queue = MutexGlobalStorage.getLocalLocksQueue()
    for (const lock of queue) {
      const posibleBlockingItems = MutexGlobalStorage.getLocalLocksQueue().filter(
        i => !lock.parents?.includes?.(i.hash) && i.hash !== lock.hash && i.isRunning && keysRelatedMatch(lock.key, i.key),
      )
      if (lock.singleAccess) {
        if (posibleBlockingItems.length === 0) {
          SharedMutexSynchronizer.continue(lock)
        }
      } else {
        if (posibleBlockingItems.every(item => !item.singleAccess)) {
          SharedMutexSynchronizer.continue(lock)
        }
      }
    }
  }

  /**
   * Continue worker in queue
   * @param key
   */
  protected static continue(item: LocalLockItem, originalStack?: string) {
    item.isRunning = true

    const message = {
      hash: item.hash,
    }

    // report debug info
    SharedMutexSynchronizer.reportDebugInfo(DEBUG_INFO_REPORTS.SCOPE_CONTINUE, item, originalStack)

    // emit it
    SharedMutexSynchronizer.masterHandler.emitter.emit('message', message)
    Object.keys(cluster.workers).forEach(workerId => SharedMutexSynchronizer.send(cluster.workers?.[workerId], message))

    // just continue - send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.continue(item)
    }
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
    } else if (message.action === ACTION.VERIFY) {
      // check if somebody overrided default config
      if (typeof SharedMutexSynchronizer.usingCustomConfiguration === 'undefined') {
        SharedMutexSynchronizer.usingCustomConfiguration = message.usingCustomConfig
      } else if (SharedMutexSynchronizer.usingCustomConfiguration !== message.usingCustomConfig) {
        // and if somebody changed it and somebody not, it should crash with it
        throw new MutexError(
          ERROR.MUTEX_CUSTOM_CONFIGURATION,
          'This is usually caused by setting custom configuration by calling initialize({...}) only in some of forks, on only in master. You need to call it everywhere with same (*or compatible) config.',
        )
      }

      SharedMutexSynchronizer.send(worker, {
        action: ACTION.VERIFY_COMPLETE,
        version,
      })
    }
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
}
