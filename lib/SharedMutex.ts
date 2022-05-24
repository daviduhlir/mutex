import { EventEmitter } from 'events'

// cluster mock
let cluster = {
  isMaster: true,
  isWorker: false,
  worker: null,
  workers: null,
  on: null,
}

try {
  cluster = require('cluster')
} catch (e) {}

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
  static lockSingleAccessDecorator(key: string, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccessDecorator(key, true, maxLockingTime)
  }

  /**
   * Lock multi access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockMultiAccessDecorator(key: string, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccessDecorator(key, false, maxLockingTime)
  }

  /**
   * Lock access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockAccessDecorator(key: string, singleAccess?: boolean, maxLockingTime?: number) {
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
export interface LockDescriptor {
  workerId: number | 'master'
  singleAccess: boolean
  hash: string
  key: string
  maxLockingTime?: number
}

export interface LocalLockItem extends LockDescriptor {
  timeout?: any
  isRunning?: boolean
}

export class SharedMutexSynchronizer {
  // internal locks array
  protected static localLocksQueue: LocalLockItem[] = []

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
   * You can use methods like getLockInfo or resetLockTimeout to get info and dealt with this situation
   * Default behaviour is to log it, if it's on master, it will throws error. If it's fork, it will kill it.
   * @param hash
   */
  static timeoutHandler: (hash: string) => void = (hash: string) => {
    const info = SharedMutexSynchronizer.getLockInfo(hash)
    console.error('MUTEX_LOCK_TIMEOUT', info)
    if (info.workerId === 'master') {
      throw new Error('MUTEX_LOCK_TIMEOUT')
    } else {
      process.kill(cluster.workers[info.workerId].process.pid, 9)
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
    // if we are using clusters at all
    if (cluster && typeof cluster.on === 'function') {
      // listen worker events
      Object.keys(cluster.workers).forEach(workerId => {
        cluster.workers[workerId].on('message', SharedMutexSynchronizer.masterIncomingMessage)
      })
      cluster.on('fork', worker => {
        worker.on('message', SharedMutexSynchronizer.masterIncomingMessage)
      })
      cluster.on('exit', worker => {
        SharedMutexSynchronizer.workerUnlockForced(worker.id)
      })
    }

    // setup functions for master
    SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage
  }

  /**
   * Lock mutex
   */
  protected static lock(key: string, workerId: number, singleAccess: boolean, hash: string, maxLockingTime: number) {
    // prepare new lock item
    const item: LocalLockItem = {
      workerId,
      singleAccess,
      hash,
      key,
      maxLockingTime,
    }

    // add it to locks
    SharedMutexSynchronizer.localLocksQueue.push(item)

    // set timeout if provided
    if (maxLockingTime) {
      item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(hash), maxLockingTime)
    }
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

    // next tick... unlock something, if waiting
    SharedMutexSynchronizer.mutexTickNext()
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

      const allKeys = SharedMutexUtils.getAllKeys(key)
      const posibleBlockingItem = SharedMutexSynchronizer.localLocksQueue.find(
        i => (i.isRunning && allKeys.includes(i.key)) || SharedMutexUtils.isChildOf(i.key, key),
      )

      // if there is something to continue
      if (queue?.length) {
        // if next is for single access
        if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItem) {
          SharedMutexSynchronizer.mutexContinue(queue[0])

          // or run all multiple access together
        } else if (runnings.every(i => !i.singleAccess) && !posibleBlockingItem?.singleAccess) {
          for (const item of queue) {
            if (item.singleAccess) {
              break
            }
            SharedMutexSynchronizer.mutexContinue(item)
          }
        }
      }
    }
  }

  /**
   * Continue worker in queue
   * @param key
   */
  protected static mutexContinue(workerIitem: LocalLockItem) {
    workerIitem.isRunning = true

    const message = {
      __mutexMessage__: true,
      hash: workerIitem.hash,
    }

    if (workerIitem.workerId === 'master') {
      SharedMutexSynchronizer.masterHandler.emitter.emit('message', message)
    } else {
      if (!cluster.workers[workerIitem.workerId].isConnected()) {
        console.error(`Worker ${workerIitem.workerId} is not longer connected. Mutex continue can't be send. Worker probably died.`)
        return
      }
      cluster.workers[workerIitem.workerId].send(message)
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
      SharedMutexSynchronizer.lock(message.key, message.workerId, message.singleAccess, message.hash, message.maxLockingTime)
      // unlock
    } else if (message.action === 'unlock') {
      SharedMutexSynchronizer.unlock(message.hash)
    }
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  protected static workerUnlockForced(workerId: number) {
    SharedMutexSynchronizer.localLocksQueue.filter(i => i.workerId === workerId).forEach(i => SharedMutexSynchronizer.unlock(i.hash))
  }
}

if (cluster.isMaster) {
  SharedMutexSynchronizer.initializeMaster()
}
