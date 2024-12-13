import { LocalLockItem } from '../utils/interfaces'

/**********************************
 *
 * Shared Mutex synchronizer
 *
 ***********************************/
export class MutexSynchronizer {
  /**
   * Lock mutex
   */
  public async lock(item: LocalLockItem, codeStack?: string) {
    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }

  /**
   * Unlock handler
   * @param key
   */
  public unlock(hash?: string, codeStack?: string) {
    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }
}
