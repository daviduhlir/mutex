import { LocalLockItem } from '../utils/interfaces'

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
  protected queue: LocalLockItem[] = []

  constructor(public options: MutexSynchronizerOptions = {}) {}

  /**
   * Lock mutex
   */
  public async lock(lock: LocalLockItem, codeStack?: string) {
    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }

  /**
   * Unlock handler
   * @param key
   */
  public unlock(hash?: string, codeStack?: string) {
    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  public unlockForced(filter: (lock: LocalLockItem) => boolean) {
    this.queue.filter(filter).forEach(i => this.unlock(i.hash))
  }
}
