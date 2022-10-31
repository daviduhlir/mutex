import cluster from './utils/clutser'
import { keysRelatedMatch, parseLockKey, randomHash } from './utils/utils'
import { SharedMutexSynchronizer } from './SharedMutexSynchronizer'
import { LockKey } from './utils/interfaces'

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
 * Single lock configuration
 */
export interface LockConfiguration {
  strictMode?: boolean
  singleAccess?: boolean
  maxLockingTime?: number
}

/**
 * Shared mutex class can lock some worker and wait for key,
 * that will be unlocked in another fork.
 */
export class SharedMutex {
  static strictMode = false
  protected static waitingMessagesHandlers: { resolve: (message: any) => void; hash: string; }[] = []
  protected static attached: boolean = false

  static stack: {
    key: string
    singleAccess: boolean
  }[] = []

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockSingleAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
    return this.lockAccess(key, fnc, true, maxLockingTime)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockMultiAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
    return this.lockAccess(key, fnc, false, maxLockingTime)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  static async lockAccess<T>(key: LockKey, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T> {
    // detect of nested locks as death ends!
    const stack = [...SharedMutex.stack]
    const myStackItem = {
      key: parseLockKey(key),
      singleAccess,
    }

    const nestedInRelatedItems = stack.filter(i => keysRelatedMatch(i.key, myStackItem.key))

    if (nestedInRelatedItems.length && SharedMutex.strictMode) {
      /*
       * Nested mutexes are not allowed, because in javascript it's complicated to tract scope, where it was locked.
       * Basicaly this kind of locks will cause you application will never continue,
       * because nested can continue after parent will be finished, which is not posible.
       */
      throw new Error(
        `ERROR Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`,
      )
    }

    // override lock for nested related locks in non strict mode
    const shouldSkipLock = nestedInRelatedItems.length && !SharedMutex.strictMode

    // lock all sub keys
    const m = !shouldSkipLock ? await SharedMutex.lock(key, { singleAccess, maxLockingTime, strictMode: SharedMutex.strictMode } ) : null
    let result
    try {
      // set stack with my key before running
      SharedMutex.stack = [...stack, myStackItem]
      result = await fnc()
      // returns stack
      SharedMutex.stack = stack
    } catch (e) {
      // returns stack in case of error
      SharedMutex.stack = stack
      // unlock all keys
      m.unlock()
      throw e
    }
    // unlock all keys
    m?.unlock()

    return result
  }

  /**
   * Lock key
   * @param key
   */
  static async lock(key: LockKey, config: LockConfiguration): Promise<SharedMutexUnlockHandler> {
    const hash = randomHash()

    // waiter function
    const waiter = new Promise((resolve: (value: any) => void) => {
      SharedMutex.waitingMessagesHandlers.push({
        hash,
        resolve: message => {
          if (message.__mutexMessage__ && message.hash === hash) {
            SharedMutex.waitingMessagesHandlers = SharedMutex.waitingMessagesHandlers.filter(i => i.hash !== hash)
            resolve(null)
          }
        }
      })
    })

    const lockKey = parseLockKey(key)
    SharedMutex.sendAction(lockKey, 'lock', hash, {
      maxLockingTime: config.maxLockingTime,
      singleAccess: config.singleAccess,
    })

    await waiter
    return new SharedMutexUnlockHandler(lockKey, hash)
  }

  /**
   * Unlock key
   * @param key
   */
  static unlock(key: LockKey, hash: string): void {
    SharedMutex.sendAction(parseLockKey(key), 'unlock', hash)
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

  /**
   * Attach handlers
   */
  static attachHandler() {
    if (!SharedMutex.attached) {
      SharedMutex.attached = true
      const eventHandler = cluster.isWorker ? process : SharedMutexSynchronizer.masterHandler.emitter
      eventHandler.addListener('message', SharedMutex.handleMessage)
    }
  }

  /**
   * Handle incomming IPC message
   */
  protected static handleMessage(message: any) {
    if (message.__mutexMessage__ && message.hash) {
      const foundItem = SharedMutex.waitingMessagesHandlers.find(item => item.hash === message.hash)
      if (foundItem) {
        foundItem.resolve(message)
      }
    }
  }
}

SharedMutex.attachHandler()
