import cluster from './utils/cluster'
import { keysRelatedMatch, parseLockKey, randomHash } from './utils/utils'
import { SharedMutexSynchronizer } from './components/SharedMutexSynchronizer'
import { LockConfiguration, LockKey, SharedMutexConfiguration } from './utils/interfaces'
import AsyncLocalStorage from './components/AsyncLocalStorage'
import { ACTION, ERROR, MASTER_ID, VERIFY_MASTER_MAX_TIMEOUT } from './utils/constants'
import { MutexError } from './utils/MutexError'
import { Awaiter } from './utils/Awaiter'
import version from './utils/version'
import { SharedMutexConfigManager } from './components/SharedMutexConfigManager'

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
  /**
   * Waiting handlers
   */
  protected static waitingMessagesHandlers: { resolve: (message: any) => void; hash: string }[] = []

  /**
   *  is attached
   */
  protected static attached: boolean = false

  /**
   * master verify
   */
  protected static masterVerificationWaiter: Awaiter = new Awaiter()
  protected static masterVerifiedTimeout = null

  /**
   * storage of data for nested keys
   */
  protected static stackStorage = new AsyncLocalStorage<
    {
      key: string
      singleAccess: boolean
    }[]
  >()

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
    const stack = [...(SharedMutex.stackStorage.getStore() || [])]
    const myStackItem = {
      key: parseLockKey(key),
      singleAccess,
    }

    const nestedInRelatedItems = stack.filter(i => keysRelatedMatch(i.key, myStackItem.key))

    const strictMode = (await SharedMutexConfigManager.getConfiguration()).strictMode

    if (nestedInRelatedItems.length && strictMode) {
      /*
       * Nested mutexes are not allowed, because in javascript it's complicated to tract scope, where it was locked.
       * Basicaly this kind of locks will cause you application will never continue,
       * because nested can continue after parent will be finished, which is not posible.
       */
      throw new MutexError(
        ERROR.MUTEX_NESTED_SCOPES,
        `ERROR Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`,
      )
    }

    // override lock for nested related locks in non strict mode
    const shouldSkipLock = nestedInRelatedItems.length && !strictMode

    // lock all sub keys
    const m = await SharedMutex.lock(key, {
      singleAccess,
      maxLockingTime: maxLockingTime === undefined ? (await SharedMutexConfigManager.getConfiguration()).defaultMaxLockingTime : maxLockingTime,
      strictMode,
      forceInstantContinue: shouldSkipLock,
    })
    let result
    try {
      result = await SharedMutex.stackStorage.run([...stack, myStackItem], fnc)
    } catch (e) {
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
          if (message.hash === hash) {
            SharedMutex.waitingMessagesHandlers = SharedMutex.waitingMessagesHandlers.filter(i => i.hash !== hash)
            resolve(null)
          }
        },
      })
    })

    const lockKey = parseLockKey(key)
    await SharedMutex.sendAction(lockKey, ACTION.LOCK, hash, {
      maxLockingTime: config.maxLockingTime,
      singleAccess: config.singleAccess,
      forceInstantContinue: config.forceInstantContinue,
    })

    await waiter
    return new SharedMutexUnlockHandler(lockKey, hash)
  }

  /**
   * Unlock key
   * @param key
   */
  static unlock(key: LockKey, hash: string): void {
    SharedMutex.sendAction(parseLockKey(key), ACTION.UNLOCK, hash)
  }

  /**
   * Initialize master handler
   */
  static async initialize(configuration?: Partial<SharedMutexConfiguration>) {
    // comm is not prepared and is not set yet... wait for next init call
    if (!(await SharedMutexConfigManager.initialize(configuration))) {
      return
    }

    // attach handlers
    if (!SharedMutex.attached) {
      SharedMutex.attached = true
      // TODO listen it on some handler
      if (cluster.isWorker) {
        ;(await SharedMutexConfigManager.getComm()).onProcessMessage(SharedMutex.handleMessage)
      } else {
        SharedMutexSynchronizer.masterHandler.emitter.on('message', SharedMutex.handleMessage)
      }
    }

    // initialize synchronizer
    await SharedMutexSynchronizer.initializeMaster()
  }

  /***********************
   *
   * Internal methods
   *
   ***********************/

  /**
   * Send action to master
   * @param key
   * @param action
   */
  protected static async sendAction(key: string, action: string, hash: string, data: any = null): Promise<void> {
    const message = {
      action,
      key,
      hash,
      ...data,
    }

    if (cluster.isWorker) {
      // is master verified? if not, send verify message to master
      await SharedMutex.verifyMaster()

      // send action
      ;(await SharedMutexConfigManager.getComm()).processSend(message)
    } else {
      if (!SharedMutexSynchronizer.masterHandler?.masterIncomingMessage) {
        throw new MutexError(
          ERROR.MUTEX_MASTER_NOT_INITIALIZED,
          'Master process does not has initialized mutex synchronizer. Usualy by missed call of SharedMutex.initialize() in master process.',
        )
      }

      // send message to master directly
      SharedMutexSynchronizer.masterHandler.masterIncomingMessage({
        ...message,
        workerId: MASTER_ID,
      })
    }
  }

  /**
   * Handle incomming IPC message
   */
  protected static handleMessage(message: any) {
    if (message.action === ACTION.VERIFY_COMPLETE) {
      if (SharedMutex.masterVerifiedTimeout) {
        clearTimeout(SharedMutex.masterVerifiedTimeout)
        SharedMutex.masterVerifiedTimeout = null

        // verify version
        if (message.version !== version) {
          throw new MutexError(
            ERROR.MUTEX_DIFFERENT_VERSIONS,
            'This is usualy caused by more than one instance of SharedMutex installed together in different version. Version of mutexes must be completly same.',
          )
        }

        // resolve verification
        SharedMutex.masterVerificationWaiter.resolve()
      } else {
        throw new MutexError(ERROR.MUTEX_REDUNDANT_VERIFICATION, 'This is usualy caused by more than one instance of SharedMutex installed together.')
      }
    } else if (message.hash) {
      const foundItem = SharedMutex.waitingMessagesHandlers.find(item => item.hash === message.hash)
      if (foundItem) {
        foundItem.resolve(message)
      }
    }
  }

  /**
   * Send verification to master, and wait until we receive success response
   */
  protected static async verifyMaster() {
    if (SharedMutex.masterVerificationWaiter.resolved) {
      return
    }

    if (SharedMutex.masterVerifiedTimeout === null) {
      // send verify ask
      ;(await SharedMutexConfigManager.getComm()).processSend({
        action: ACTION.VERIFY,
        usingCustomConfig: await SharedMutexConfigManager.getUsingDefaultConfig(),
      })

      // timeout for wait to init
      SharedMutex.masterVerifiedTimeout = setTimeout(() => {
        throw new MutexError(
          ERROR.MUTEX_MASTER_NOT_INITIALIZED,
          'Master process does not has initialized mutex synchronizer. Usualy by missed call of SharedMutex.initialize() in master process.',
        )
      }, VERIFY_MASTER_MAX_TIMEOUT)
    }

    // wait for verification done
    return SharedMutex.masterVerificationWaiter.wait()
  }
}
