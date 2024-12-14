import { LocalLockItem, LockItemInfo } from '../utils/interfaces'
import { sanitizeLock, getLockInfo } from '../utils/utils'
import { Algorythms } from '../algorythms'
import { MutexError } from '../utils/MutexError'
import { ERROR } from '../utils/constants'
import { MutexSynchronizer, MutexSynchronizerOptions } from './MutexSynchronizer'

/**********************************
 *
 * Mutex synchronizer
 *
 ***********************************/
export class LocalMutexSynchronizer extends MutexSynchronizer {
  /**
   * Default handler
   */
  static timeoutHandler: (item: LocalLockItem) => void = (item: LocalLockItem) => {
    console.error(ERROR.MUTEX_LOCK_TIMEOUT, item)
    throw new MutexError(ERROR.MUTEX_LOCK_TIMEOUT)
  }

  /**
   * Construct with options
   */
  constructor(readonly options: MutexSynchronizerOptions = {}) {
    super(options)
    if (!options.timeoutHandler) {
      options.timeoutHandler = LocalMutexSynchronizer.timeoutHandler
    }
  }

  /**
   * Get count of locks currently
   * @returns
   */
  getLocksCount(): number {
    return this.queue.length
  }

  /**
   * Lock mutex
   */
  public async lock(lock: LocalLockItem, codeStack?: string) {
    // add it to locks
    const nItem = { ...lock, codeStack, timing: { locked: Date.now() } }
    this.queue.push(nItem)

    // set timeout if provided
    if (nItem.maxLockingTime) {
      nItem.timeout = setTimeout(() => this.lockTimeout(nItem.hash), nItem.maxLockingTime)
    }

    const waiter = new Promise((resolve, reject) => {
      nItem.reject = reject
      nItem.resolve = resolve as () => void
    })

    // next tick... unlock something, if waiting
    this.mutexTickNext()

    // await for continue
    await waiter
  }

  /**
   * Unlock handler
   * @param key
   */
  public unlock(hash?: string, codeStack?: string) {
    const f = this.queue.find(foundItem => foundItem.hash === hash)
    if (!f) {
      return
    }

    // clear timeout, if exists
    if (f.timeout) {
      clearTimeout(f.timeout)
    }

    // remove from queue
    this.queue = this.queue.filter(item => item.hash !== hash)

    // next tick... unlock something, if waiting
    this.mutexTickNext()
  }

  /**
   * Get info about lock by hash
   * @param hash
   * @returns
   */
  public getLockInfo(hash: string): LockItemInfo {
    return getLockInfo(this.queue, hash)
  }

  /**
   * Tick of mutex run, it will continue next mutex(es) in queue
   */
  protected mutexTickNext() {
    const changes: string[] = []

    Algorythms.solveGroup(
      [...this.queue],
      changes,
      this.options.debugDeadEnds
        ? (lock, inCollisionHashes) => {
            this.sendException(lock, 'Dead end detected, this combination will never be unlocked. See the documentation.', {
              inCollision: inCollisionHashes.map(hash => sanitizeLock(this.getLockInfo(hash))),
            })
          }
        : null,
    )

    for (const hash of changes) {
      this.continue(hash)
    }
    if (changes.length) {
      this.mutexTickNext()
    }
  }

  /**
   * Continue worker in queue
   * @param key
   */
  protected continue(hash: string, originalStack?: string) {
    const item = this.queue.find(i => i.hash === hash)
    item.isRunning = true
    item.timing.opened = Date.now()
    // emit it
    if (!item.resolve) {
      throw new Error(`MUTEX item ${item.hash} resolver is not set`)
    }
    item.resolve()
  }

  /**
   * Lock timeout handler
   */
  protected lockTimeout = (hash: string) => {
    const item = this.queue.find(i => i.hash === hash)
    if (item.reject) {
      item.reject(new MutexError(ERROR.MUTEX_LOCK_TIMEOUT, `Lock timeout`, this.getLockInfo(item.hash)))
    }
    this.options.timeoutHandler(item)
    this.unlock(hash)
  }

  /**
   * Broadcast exception
   */
  protected sendException = (item: LocalLockItem, message: string, details?: any) => {
    if (item.reject) {
      item.reject(new MutexError(ERROR.MUTEX_NOTIFIED_EXCEPTION, message, this.getLockInfo(item.hash), details))
    }
  }
}
