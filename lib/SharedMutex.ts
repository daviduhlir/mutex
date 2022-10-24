import cluster from './utils/clutser'
import { parseLockKey, randomHash } from './utils/utils'
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
 * Shared mutex class can lock some worker and wait for key,
 * that will be unlocked in another fork.
 */
export class SharedMutex {
  public static warningThrowsError = false

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
    const nestedOfItem = stack.filter(i => i.key === myStackItem.key)
    if (nestedOfItem.length && [...nestedOfItem.map(i => i.singleAccess), singleAccess].some(i => !!i)) {
      /*
       * Nested mutexes are not allowed, because in javascript it's complicated to tract scope, where it was locked.
       * Basicaly this kind of locks will cause you application will never continue,
       * because nested can continue after parent will be finished, which is not posible.
       */
      SharedMutex.warning(`MUTEX ERROR: Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`)
    }

    // lock all sub keys
    const m = await SharedMutex.lock(key, singleAccess, maxLockingTime)
    let r
    try {
      SharedMutex.stack = [...stack, myStackItem]
      r = await fnc()
      SharedMutex.stack = stack
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
  static async lock(key: LockKey, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler> {
    const hash = randomHash()

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

    const lockKey = parseLockKey(key)
    SharedMutex.sendAction(lockKey, 'lock', hash, {
      maxLockingTime,
      singleAccess,
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
   * Warn user before app freezes
   */
  protected static warning(message: string) {
    if (SharedMutex.warningThrowsError) {
      throw new Error(`MUTEX: ${message}`)
    } else {
      console.warn(`MUTEX: ${message}`)
    }
  }
}
