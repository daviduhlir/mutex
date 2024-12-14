import cluster from '../utils/cluster'
import { ERROR } from '../utils/constants'
import { LocalLockItem, LockItemInfo } from '../utils/interfaces'
import { MutexError } from '../utils/MutexError'

/**********************************
 *
 * Shared Mutex synchronizer
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
   * Timeout handler, for handling if lock was freezed for too long time
   * You can set this handler to your own, to make decision what to do in this case
   * You can use methods like getLockInfo or resetLockTimeout to get info and deal with this situation
   * Default behaviour is to log it, if it's on master, it will throws error. If it's fork, it will kill it.
   */
  timeoutHandler?: (item: LocalLockItem) => void
}

export class MutexSynchronizer {
  constructor(public options: MutexSynchronizerOptions = {}) {}

  /**
   * Lock mutex
   */
  public async lock(lock: LocalLockItem, codeStack?: string) {
    throw new Error('override it')
  }

  /**
   * Unlock handler
   * @param key
   */
  public unlock(hash?: string, codeStack?: string) {
    throw new Error('override it')
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  public unlockForced(filter: (lock: LocalLockItem) => boolean) {
    throw new Error('override it')
  }

  /**
   * Get info about lock by hash
   * @param hash
   * @returns
   */
  public getLockInfo(hash: string): LockItemInfo {
    throw new Error('override it')
  }

  /**
   * Watchdog with phase report
   */
  public async watchdog(hash: string, phase?: string, args?: any, codeStack?: string) {
    throw new Error('override it')
  }

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
    console.log('HANDLER CALLED!!!!!!!!!!!!!!!!')
    if (item.workerId && cluster?.workers?.[item.workerId]) {
      console.error(ERROR.MUTEX_LOCK_TIMEOUT, item)
      cluster.workers[item.workerId].kill(9)
    } else {
      throw new MutexError(ERROR.MUTEX_LOCK_TIMEOUT)
    }
  }
}
