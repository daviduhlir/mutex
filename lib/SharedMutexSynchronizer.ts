import { EventEmitter } from 'events'
import cluster from './utils/cluster'
import { LocalLockItem, LockDescriptor } from './utils/interfaces'
import { SecondarySynchronizer, SYNC_EVENTS } from './SecondarySynchronizer'
import { keysRelatedMatch, sanitizeLock } from './utils/utils'

/**********************************
 *
 * cluster synchronizer
 *
 ***********************************/
export class SharedMutexSynchronizer {
  // internal locks array
  protected static localLocksQueue: LocalLockItem[] = []
  protected static alreadyInitialized: boolean = false
  protected static secondarySynchronizer: SecondarySynchronizer = null

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
      return // this lock is not exsists
    }

    console.error('MUTEX_LOCK_TIMEOUT', info)
    if (info.workerId === 'master') {
      throw new Error('MUTEX_LOCK_TIMEOUT')
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
    const item = this.localLocksQueue.find(i => i.hash === hash)
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
    const item = this.localLocksQueue.find(i => i.hash === hash)
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
  static initializeMaster() {
    if (SharedMutexSynchronizer.alreadyInitialized || !cluster.isMaster) {
      return
    }

    // if we are using clusters at all
    if (cluster && typeof cluster.on === 'function') {
      cluster.on('message', SharedMutexSynchronizer.handleClusterMessage)
      cluster.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id))
    }

    // setup functions for master
    SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage

    // already initialized
    SharedMutexSynchronizer.alreadyInitialized = true
  }

  /**
   * Lock mutex
   */
  protected static lock(item: LocalLockItem) {
    // add it to locks
    SharedMutexSynchronizer.localLocksQueue.push({ ...item })

    // set timeout if provided
    if (item.maxLockingTime) {
      item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(item.hash), item.maxLockingTime)
    }

    // send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.lock(item)
    }

    // next tick... unlock something, if waiting
    SharedMutexSynchronizer.mutexTickNext()
  }

  /**
   * Unlock handler
   * @param key
   * @param workerId
   */
  protected static unlock(hash?: string) {
    const f = SharedMutexSynchronizer.localLocksQueue.find(foundItem => foundItem.hash === hash)
    if (!f) {
      return
    }

    // clear timeout, if exists
    if (f.timeout) {
      clearTimeout(f.timeout)
    }

    // remove from queue
    SharedMutexSynchronizer.localLocksQueue = SharedMutexSynchronizer.localLocksQueue.filter(item => item.hash !== hash)

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

    // continue, if item was forced to continue
    const topItem = SharedMutexSynchronizer.localLocksQueue[SharedMutexSynchronizer.localLocksQueue.length - 1]
    if (topItem?.forceInstantContinue) {
      SharedMutexSynchronizer.continue(topItem)
    }

    const allKeys = SharedMutexSynchronizer.localLocksQueue.reduce((acc, i) => {
      return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind)
    }, [])

    for (const key of allKeys) {
      const queue = SharedMutexSynchronizer.localLocksQueue.filter(i => i.key === key)

      // if there is something to continue
      if (queue?.length) {
        const runnings = queue.filter(i => i.isRunning)

        // find posible blocking parents or childs
        const posibleBlockingItems = SharedMutexSynchronizer.localLocksQueue.filter(i => i.isRunning && keysRelatedMatch(key, i.key) && key !== i.key)

        // if next is for single access
        if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItems.length) {
          SharedMutexSynchronizer.continue(queue[0])

          // or run all multiple access together
        } else if (runnings.every(i => !i.singleAccess) && posibleBlockingItems.every(i => !i?.singleAccess)) {
          for (const item of queue) {
            if (item.singleAccess) {
              break
            }
            SharedMutexSynchronizer.continue(item)
          }
        }
      }
    }
  }

  /**
   * Continue worker in queue
   * @param key
   */
  protected static continue(item: LocalLockItem) {
    item.isRunning = true

    const message = {
      __mutexMessage__: true,
      hash: item.hash,
    }

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
    if (!(message as any).__mutexMessage__ || !message.action) {
      return
    }

    // lock
    if (message.action === 'lock') {
      SharedMutexSynchronizer.lock(sanitizeLock(message))
      // unlock
    } else if (message.action === 'unlock') {
      SharedMutexSynchronizer.unlock(message.hash)
      // verify master handler
    } else if (message.action === 'verify') {
      SharedMutexSynchronizer.send(worker, {
        action: 'verify-complete',
      })
    }
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  protected static workerUnlockForced(workerId: number) {
    SharedMutexSynchronizer.localLocksQueue.filter(i => i.workerId === workerId).forEach(i => SharedMutexSynchronizer.unlock(i.hash))
  }

  /**
   * Send message to worker
   */
  protected static send(worker: any, message: any) {
    worker.send(
      {
        __mutexMessage__: true,
        ...message,
      },
      err => {
        if (err) {
          // TODO - not sure what to do, worker probably died
        }
      },
    )
  }
}
