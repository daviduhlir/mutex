import { keysRelatedMatch, parseLockKey, randomHash } from '../utils/utils'
import { LocalLockItem, LockKey } from '../utils/interfaces'
import AsyncLocalStorage from './AsyncLocalStorage'
import { getStack } from '../utils/stack'
import { MutexSynchronizer, MutexSynchronizerOptions } from './MutexSynchronizer'
import cluster from '../utils/cluster'
import { Awaiter } from '../utils/Awaiter'
import { MutexError } from '../utils/MutexError'
import { ERROR, REJECTION_REASON } from '../utils/constants'

/**
 * Unlock handler
 */
export interface SharedMutexUnlockHandler {
  unlock(): void
}

/**
 * Shared mutex class can lock some worker and wait for key,
 * that will be unlocked in another fork.
 */
export class MutexExecutor {
  /**
   * Creates with synchronizer
   */
  constructor(readonly synchronizer: MutexSynchronizer) {}

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockSingleAccess<T>(key: LockKey, handler: () => Promise<T>, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }
    return this.lockAccess(key, handler, true, maxLockingTime, codeStack)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockMultiAccess<T>(key: LockKey, handler: () => Promise<T>, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }
    return this.lockAccess(key, handler, false, maxLockingTime, codeStack)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockAccess<T>(
    key: LockKey,
    handler: () => Promise<T>,
    singleAccess?: boolean,
    maxLockingTime?: number,
    codeStack?: string,
  ): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }

    // item hash
    const hash = randomHash()

    // item for stack
    const myStackItem = {
      hash,
      key: parseLockKey(key),
      singleAccess,
      id: this.id,
    }

    // detect of nested locks as death ends!
    const stack = [...(MutexExecutor.stackStorage.getStore() || [])]
    const nestedInRelatedItems = stack.filter(i => keysRelatedMatch(myStackItem.key, i.key) && i.id === this.id)

    // lock all sub keys
    let m = await this.lock(
      key,
      {
        hash,
        singleAccess,
        maxLockingTime: typeof maxLockingTime === 'number' ? maxLockingTime : this.synchronizer.options.defaultMaxLockingTime,
        parents: nestedInRelatedItems.map(i => i.hash),
        tree: stack.map(i => i.hash),
        workerId: cluster.worker?.id,
      },
      codeStack,
    )

    // unlock function with clearing mutex ref
    const unlocker = () => {
      m?.unlock()
      m = null
    }

    // awaiter for result
    const funcAwaiter = new Awaiter()

    // wait for rejection
    if (this.synchronizer.options.continueOnTimeout) {
      this.synchronizer.setScopeRejector(hash, reason => funcAwaiter.reject(reason))
    }

    // run function
    let result
    let error
    try {
      MutexExecutor.stackStorage.run([...stack, myStackItem], handler).then(
        returnedValue => funcAwaiter.resolve(returnedValue),
        err => funcAwaiter.reject(err),
      )
      result = await funcAwaiter.wait()
    } catch (e) {
      error = e
    }

    // unlock all keys
    this.synchronizer.removeScopeRejector(hash)
    unlocker()

    // result
    if (error) {
      throw error
    }
    return result
  }

  /**
   * Set options
   */
  setOptions(options: MutexSynchronizerOptions) {
    this.synchronizer?.setOptions?.(options)
  }

  /**
   * Watchdog for current scope
   */
  async watchdog(phase?: string, args?: any) {
    const stack = [...(MutexExecutor.stackStorage.getStore() || [])]
    const currentScope = stack[stack.length - 1]
    if (currentScope?.hash) {
      await this.synchronizer.watchdog(currentScope.hash, phase, args, getStack())
    }
  }

  /************************************
   *
   * Internal methods
   *
   ************************************/

  /**
   * Storage id
   */
  private id = randomHash()

  /**
   * Waiting handlers
   */
  protected waitingMessagesHandlers: { resolve: (message: any) => void; hash: string; action: string }[] = []

  /**
   * storage of data for nested keys
   */
  protected static stackStorage = new AsyncLocalStorage<
    {
      hash: string
      key: string
      singleAccess: boolean
      id: string
    }[]
  >()

  /**
   * Lock key
   * @param key
   */
  protected async lock(key: LockKey, itemData: Omit<LocalLockItem, 'key'>, codeStack?: string): Promise<SharedMutexUnlockHandler> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }

    const item = {
      ...itemData,
      key: parseLockKey(key),
    }

    try {
      await this.synchronizer.lock(item, codeStack)
      return {
        unlock: () => this.unlock(item.hash),
      }
    } catch (e) {
      this.unlock(item.hash)
      throw e
    }
  }

  /**
   * Unlock key
   * @param key
   */
  protected unlock(hash: string): void {
    this.synchronizer.unlock(hash)
  }
}
