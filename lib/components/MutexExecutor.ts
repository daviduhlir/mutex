import { keysRelatedMatch, parseLockKey, randomHash, searchKiller } from '../utils/utils'
import { LocalLockItem, LockKey, MutexStackItem } from '../utils/interfaces'
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

export type MutexHandler<T> = () => Promise<T>

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
  async lockSingleAccess<T>(lockKey: LockKey, handler: MutexHandler<T>, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }
    return this.lockAccess(lockKey, handler, true, maxLockingTime, codeStack)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockMultiAccess<T>(lockKey: LockKey, handler: MutexHandler<T>, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }
    return this.lockAccess(lockKey, handler, false, maxLockingTime, codeStack)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockAccess<T>(lockKey: LockKey, handler: MutexHandler<T>, singleAccess?: boolean, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack && this.synchronizer.options.debugWithStack) {
      codeStack = getStack()
    }

    // item hash
    const hash = randomHash()
    const key = parseLockKey(lockKey)

    // detect of nested locks as death ends!
    const stack = [...(MutexExecutor.stackStorage.getStore() || [])]
    const nestedInRelatedItems = stack.filter(i => keysRelatedMatch(key, i.key) && i.id === this.id)

    // item for stack
    const myStackItem: MutexStackItem = {
      hash,
      key,
      singleAccess,
      id: this.id,
      tree: stack,
    }

    // dead end detects
    if (this.synchronizer.options.debugDeadEnds) {
      const foundKiller = searchKiller(myStackItem, MutexExecutor.allLocks)
      if (foundKiller) {
        throw new MutexError(
          ERROR.MUTEX_NOTIFIED_EXCEPTION,
          'Dead end detected, this combination will never be unlocked. See the documentation.',
          myStackItem,
          { reason: REJECTION_REASON.DEAD_END, inCollision: foundKiller, detectedFromStack: true },
        )
      }
    }

    // lock all sub keys
    let m

    const lock = async () => {
      // register to all locks in this worker
      MutexExecutor.allLocks.push(myStackItem)
      try {
        m = await this.lock(
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
      } catch (e) {
        MutexExecutor.allLocks = MutexExecutor.allLocks.filter(item => item.hash !== myStackItem.hash)
        throw e
      }
    }

    // lock it
    await lock()

    // set it running
    MutexExecutor.allLocks.find(item => item.hash === myStackItem.hash).running = true

    // unlock function with clearing mutex ref
    const unlock = () => {
      // remove it from running locks
      MutexExecutor.allLocks = MutexExecutor.allLocks.filter(item => item.hash !== myStackItem.hash)

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
    unlock()

    this.synchronizer.removeScopeRejector(hash)

    // result
    if (error) {
      throw error
    }
    return result
  }

  /**
   * Set options
   */
  setOptions(options: Partial<MutexSynchronizerOptions>) {
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
  protected static stackStorage = new AsyncLocalStorage<MutexStackItem[]>()
  protected static allLocks: MutexStackItem[] = []

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
