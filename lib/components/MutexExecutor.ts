import { keysRelatedMatch, parseLockKey, randomHash } from '../utils/utils'
import { LocalLockItem, LockKey } from '../utils/interfaces'
import AsyncLocalStorage from './AsyncLocalStorage'
import { getStack } from '../utils/stack'
import { MutexSynchronizer } from './MutexSynchronizer'

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
  constructor(readonly synchronizer: MutexSynchronizer) {}

  /**
   * Waiting handlers
   */
  protected waitingMessagesHandlers: { resolve: (message: any) => void; hash: string; action: string }[] = []

  /**
   * storage of data for nested keys
   */
  protected stackStorage = new AsyncLocalStorage<
    {
      hash: string
      key: string
      singleAccess: boolean
    }[]
  >()

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockSingleAccess<T>(key: LockKey, handler: () => Promise<T>, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack) {
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
    if (!codeStack) {
      codeStack = getStack()
    }
    return this.lockAccess(key, handler, false, maxLockingTime, codeStack)
  }

  /**
   * Lock some async method
   * @param keysPath
   * @param fnc
   */
  async lockAccess<T>(key: LockKey, handler: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number, codeStack?: string): Promise<T> {
    if (!codeStack) {
      codeStack = getStack()
    }

    const hash = randomHash()

    const myStackItem = {
      hash,
      key: parseLockKey(key),
      singleAccess,
    }

    // detect of nested locks as death ends!
    const stack = [...(this.stackStorage.getStore() || [])]
    const nestedInRelatedItems = stack.filter(i => keysRelatedMatch(myStackItem.key, i.key))

    // lock all sub keys
    let m = await this.lock(
      key,
      {
        hash,
        singleAccess,
        maxLockingTime,
        parents: nestedInRelatedItems.map(i => i.hash),
        tree: stack.map(i => i.hash),
      },
      codeStack,
    )

    // unlock function with clearing mutex ref
    const unlocker = () => {
      m?.unlock()
      m = null
    }

    // run function
    let result
    try {
      result = await this.stackStorage.run([...stack, myStackItem], handler)
    } catch (e) {
      // unlock all keys
      unlocker()
      throw e
    }
    // unlock all keys
    unlocker()

    return result
  }

  /**
   * Lock key
   * @param key
   */
  protected async lock(key: LockKey, itemData: Omit<LocalLockItem, 'key'>, codeStack?: string): Promise<SharedMutexUnlockHandler> {
    if (!codeStack) {
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
  unlock(hash: string): void {
    this.synchronizer.unlock(hash)
  }
}
