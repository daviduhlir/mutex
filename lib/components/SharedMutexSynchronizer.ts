import cluster from '../utils/cluster'
import { LocalLockItem } from '../utils/interfaces'
import { LocalMutexSynchronizer } from './LocalMutexSynchronizer'
import { MutexSynchronizer, MutexSynchronizerOptions } from './MutexSynchronizer'

/**********************************
 *
 * Shared Mutex synchronizer
 *
 ***********************************/
export class SharedMutexSynchronizer extends MutexSynchronizer {
  protected masterSynchronizer: LocalMutexSynchronizer
  /**
   * Construct with options
   */
  constructor(readonly identifier: string, readonly options: MutexSynchronizerOptions = {}) {
    super(options)
    this.initialize()
  }

  /**
   * Lock mutex
   */
  public async lock(item: LocalLockItem, codeStack?: string) {
    if (this.masterSynchronizer) {
      return this.masterSynchronizer.lock(item, codeStack)
    }

    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }

  /**
   * Unlock handler
   * @param key
   */
  public unlock(hash?: string, codeStack?: string) {
    if (this.masterSynchronizer) {
      return this.masterSynchronizer.unlock(hash, codeStack)
    }

    // TODO if it's in same process, just call it, otherwise, send it by IPC and wait result
  }

  /**
   * Worker/master init
   */
  protected initialize() {
    if (cluster.isWorker) {
      // TODO attach events from master
    } else {
      this.masterSynchronizer = new LocalMutexSynchronizer(this.options)
      // TODO attach events from cluster
    }
  }
}
