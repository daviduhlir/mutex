import { EventEmitter } from 'events'
import cluster from './clutser'
import { LocalLockItem, LockDescriptor } from './interfaces'
import { SecondarySynchronizer, SYNC_EVENTS } from './SecondarySynchronizer'

/**
 * Utils class
 */
class SharedMutexUtils {
  static randomHash(): string {
    return [...Array(10)]
      .map(x => 0)
      .map(() => Math.random().toString(36).slice(2))
      .join('')
  }

  static getAllKeys(key: string): string[] {
    return key
      .split('/')
      .filter(Boolean)
      .reduce((acc, item, index, array) => {
        return [...acc, array.slice(0, index + 1).join('/')]
      }, [])
  }

  static isChildOf(key: string, parentKey: string): boolean {
    const childKeys = SharedMutexUtils.getAllKeys(key)
    const index = childKeys.indexOf(parentKey)
    if (index !== -1 && index !== childKeys.length - 1) {
      return true
    }
    return false
  }
}

/**
 * Unlock handler
 */
export class SharedMutexUnlockHandler {
  constructor(public readonly key: string, public readonly hash: string) {}

  unlock(): void {
    SharedMutex.unlock(this.key, this.hash)
  }
}

/**
 * Shared mutex decorator utils class
 */
export class SharedMutexDecorators {
  /**
   * Lock single access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockSingleAccess(key: string, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccess(key, true, maxLockingTime)
  }

  /**
   * Lock multi access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockMultiAccess(key: string, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccess(key, false, maxLockingTime)
  }

  /**
   * Lock access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockAccess(key: string, singleAccess?: boolean, maxLockingTime?: number) {
    return (_target, _name, descriptor) => {
      if (typeof descriptor.value === 'function') {
        const original = descriptor.value
        descriptor.value = function (...args) {
          return SharedMutex.lockAccess(key, () => original(...args), singleAccess, maxLockingTime)
        }
      }
      return descriptor
    }
  }
}

/**
 * Shared mutex class can lock some worker and wait for key,
 * that will be unlocked in another fork.
 */
export class SharedMutex {
  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockSingleAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
    return this.lockAccess(key, fnc, true, maxLockingTime)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockMultiAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
    return this.lockAccess(key, fnc, false, maxLockingTime)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockAccess<T>(key: string, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T> {
    // lock all sub keys
    const m = await SharedMutex.lock(key, singleAccess, maxLockingTime)
    let r
    try {
      r = await fnc()
    } catch (e) {
      // unlock all keys
      m.unlock()
      throw e
    }
    // unlock all keys
    m.unlock()
    return r
  }

  /**
   * Lock key
   * @param key
   */
  static async lock(key: string, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler> {
    const hash = SharedMutexUtils.randomHash()

    const eventHandler = cluster.isWorker ? process : SharedMutexSynchronizer.masterHandler.emitter

    // waiter function
    const waiter = new Promise((resolve: (value: any) => void) => {
      const handler = message => {
        if (message.__mutexMessage__ && message.hash === hash) {
          eventHandler.removeListener('message', handler)
          resolve(null)
        }
      }
      eventHandler.addListener('message', handler)
    })

    SharedMutex.sendAction(key, 'lock', hash, {
      maxLockingTime,
      singleAccess,
    })

    await waiter
    return new SharedMutexUnlockHandler(key, hash)
  }

  /**
   * Unlock key
   * @param key
   */
  static unlock(key: string, hash: string): void {
    SharedMutex.sendAction(key, 'unlock', hash)
  }

  /**
   * Send action to master
   * @param key
   * @param action
   */
  protected static sendAction(key: string, action: string, hash: string, data: any = null): void {
    const message = {
      __mutexMessage__: true,
      action,
      key,
      hash,
      ...data,
    }

    if (cluster.isWorker) {
      process.send({
        ...message,
        workerId: cluster.worker?.id,
      })
    } else {
      SharedMutexSynchronizer.masterHandler.masterIncomingMessage({
        ...message,
        workerId: 'master',
      })
    }
  }
}

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
      // listen worker events
      SharedMutexSynchronizer.reattachMessageHandlers()

      cluster?.on('fork', worker => {
        worker.on('message', SharedMutexSynchronizer.reattachMessageHandlers)
      })
      cluster?.on('exit', worker => {
        SharedMutexSynchronizer.workerUnlockForced(worker.id)
      })
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
    SharedMutexSynchronizer.localLocksQueue.push({...item})

    // set timeout if provided
    if (item.maxLockingTime) {
      item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(item.hash), item.maxLockingTime)
    }

    // send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.lock(item)
    }

    // next tick... unlock something, if waiting
    if (!SharedMutexSynchronizer.secondarySynchronizer || SharedMutexSynchronizer.secondarySynchronizer?.isArbitter) {
      SharedMutexSynchronizer.mutexTickNext()
    }
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
    if (!SharedMutexSynchronizer.secondarySynchronizer || SharedMutexSynchronizer.secondarySynchronizer?.isArbitter) {
      SharedMutexSynchronizer.mutexTickNext()
    }
  }

  /**
   * Tick of mutex run, it will continue next mutex(es) in queue
   */
  protected static mutexTickNext() {
    const allKeys = SharedMutexSynchronizer.localLocksQueue.reduce((acc, i) => {
      return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind)
    }, [])

    for (const key of allKeys) {
      const queue = SharedMutexSynchronizer.localLocksQueue.filter(i => i.key === key)
      const runnings = queue.filter(i => i.isRunning)

      // find posible blocking parents or childs
      const allSubKeys = SharedMutexUtils.getAllKeys(key)
      const posibleBlockingItems = SharedMutexSynchronizer.localLocksQueue.filter(
        i => (i.isRunning && allSubKeys.includes(i.key)) || SharedMutexUtils.isChildOf(i.key, key),
      )

      // if there is something to continue
      if (queue?.length) {
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
    Object.keys(cluster.workers).forEach(workerId => cluster.workers?.[workerId]?.send(message))

    // just continue - send to secondary
    if (SharedMutexSynchronizer.secondarySynchronizer) {
      SharedMutexSynchronizer.secondarySynchronizer.continue(item)
    }
  }

  /**
   * Handle master incomming message
   * @param message
   */
  protected static masterIncomingMessage(message: any) {
    if (!(message as any).__mutexMessage__ || !message.action) {
      return
    }

    // lock
    if (message.action === 'lock') {
      SharedMutexSynchronizer.lock(message)
      // unlock
    } else if (message.action === 'unlock') {
      SharedMutexSynchronizer.unlock(message.hash)
    }
  }

  /**
   * Reattach all message handlers if new fork or some exited
   */
  protected static reattachMessageHandlers() {
    Object.keys(cluster.workers).forEach(workerId => {
      cluster.workers?.[workerId]?.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage)
      cluster.workers?.[workerId]?.addListener('message', SharedMutexSynchronizer.masterIncomingMessage)
    })
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  protected static workerUnlockForced(workerId: number) {
    cluster.workers?.[workerId]?.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage)
    SharedMutexSynchronizer.localLocksQueue.filter(i => i.workerId === workerId).forEach(i => SharedMutexSynchronizer.unlock(i.hash))
  }
}
