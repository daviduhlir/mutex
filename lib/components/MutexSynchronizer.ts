import cluster from '../utils/cluster'
import { ERROR } from '../utils/constants'
import { LocalLockItem, LockItemInfo } from '../utils/interfaces'
import { MutexError } from '../utils/MutexError'

/**********************************
 *
 * Mutex synchronizer
 *
 ***********************************/

export interface MutexSynchronizerOptions {
  /**
   * Detect dead ends
   */
  debugDeadEnds?: boolean

  /**
   * Report debug info with stack
   */
  debugWithStack?: boolean

  /**
   * Default max locking time
   */
  defaultMaxLockingTime?: number

  /**
   * Rejects scope in timeout, error will be thrown
   */
  continueOnTimeout?: boolean

  /**
   * Timeout handler, for handling if lock was freezed for too long time
   * You can set this handler to your own, to make decision what to do in this case
   * You can use methods like getLockInfo or resetLockTimeout to get info and deal with this situation
   * Default behaviour is to log it, if it's on master, it will throws error. If it's fork, it will kill it.
   */
  timeoutHandler?: (item: LocalLockItem) => void
}

export abstract class MutexSynchronizer {
  constructor(public options: MutexSynchronizerOptions = {}) {}

  /**
   * Get count of locks currently
   * @returns
   */
  abstract getLocksCount(): number

  /**
   * Lock mutex
   */
  abstract lock(lock: LocalLockItem, codeStack?: string): Promise<void>

  /**
   * Unlock handler
   * @param key
   */
  abstract unlock(hash?: string, codeStack?: string)

  /**
   * Forced unlock of worker
   * @param id
   */
  abstract unlockForced(filter: (lock: LocalLockItem) => boolean)

  /**
   * Get info about lock by hash
   * @param hash
   * @returns
   */
  abstract getLockInfo(hash: string): LockItemInfo

  /**
   * Watchdog with phase report
   */
  abstract watchdog(hash: string, phase?: string, args?: any, codeStack?: string): Promise<void>

  /**
   * Get lock item
   */
  abstract getLockItem(hash: string): LocalLockItem

  /**
   * Set scope rejector
   */
  abstract setScopeRejector(hash: string, rejector: (reason) => void)
  abstract removeScopeRejector(hash: string)

  /**
   * Check if nothing is opened here
   */
  abstract isClear(): boolean

  /**
   * Set options
   */
  public setOptions(options: MutexSynchronizerOptions) {
    this.options = options
  }

  /**
   * Default handler
   */
  static timeoutHandler(item: LocalLockItem) {
    if (item.workerId && cluster?.workers?.[item.workerId]) {
      console.error(ERROR.MUTEX_LOCK_TIMEOUT, item)
      cluster.workers[item.workerId].kill(9)
    } else {
      throw new MutexError(ERROR.MUTEX_LOCK_TIMEOUT)
    }
  }
}
