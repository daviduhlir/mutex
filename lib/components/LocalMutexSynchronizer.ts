import { LocalLockItem, LockItemInfo, LockStatus } from '../utils/interfaces'
import { getLockInfo, sanitizeLock } from '../utils/utils'
import { Algorythms } from '../algorythms'
import { MutexError } from '../utils/MutexError'
import { ERROR, WATCHDOG_STATUS } from '../utils/constants'
import { MutexSynchronizer } from './MutexSynchronizer'

/**********************************
 *
 * Mutex synchronizer
 *
 ***********************************/
export class LocalMutexSynchronizer extends MutexSynchronizer {
  protected queue: LocalLockItem[] = []

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
   * Forced unlock of worker
   * @param id
   */
  public unlockForced(filter: (lock: LocalLockItem) => boolean) {
    this.queue.filter(filter).forEach(i => this.unlock(i.hash))
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
   * Watchdog with phase report
   */
  public async watchdog(hash: string, phase?: string, args?: any, codeStack?: string) {
    const item = this.queue.find(i => i.hash === hash)
    if (!item) {
      throw new MutexError(ERROR.MUTEX_WATCHDOG_REJECTION, `Item no longer exists`, undefined, { hash })
    }
    if (phase) {
      if (!item.reportedPhases) {
        item.reportedPhases = []
      }
      item.reportedPhases.push({ phase, codeStack, args })
    }
    if (item.status === WATCHDOG_STATUS.TIMEOUTED) {
      throw new MutexError(ERROR.MUTEX_WATCHDOG_REJECTION, `Mutex scope was rejected by watchdog on phase ${phase}`, this.getLockInfo(hash), {
        args: args,
      })
    }
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
    if (item) {
      item.status = WATCHDOG_STATUS.TIMEOUTED as LockStatus
    }

    if (!this.options.timeoutHandler) {
      MutexSynchronizer.timeoutHandler(item)
    } else {
      this.options.timeoutHandler(item)
    }
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
