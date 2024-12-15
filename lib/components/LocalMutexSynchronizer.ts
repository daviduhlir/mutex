import { LocalLockItem, LockItemInfo, LockStatus } from '../utils/interfaces'
import { getLockInfo, sanitizeLock } from '../utils/utils'
import { Algorythms } from '../algorythms'
import { MutexError } from '../utils/MutexError'
import { ERROR, WATCHDOG_STATUS } from '../utils/constants'
import { MutexSynchronizer, MutexSynchronizerOptions } from './MutexSynchronizer'

/**********************************
 *
 * Mutex synchronizer
 *
 ***********************************/
export class LocalMutexSynchronizer extends MutexSynchronizer {
  constructor(
    public options: MutexSynchronizerOptions = {},
    readonly scopesRejector?: (item: LocalLockItem, reason: string, message: string) => void,
  ) {
    super(options)
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
  async lock(lock: LocalLockItem, codeStack?: string) {
    // add it to locks
    const nItem = { ...lock, codeStack, timing: { locked: Date.now() } }
    this.queue.push(nItem)

    // set timeout if provided
    if (nItem.maxLockingTime) {
      nItem.timeout = setTimeout(() => this.lockTimeout(nItem.hash), nItem.maxLockingTime)
    }

    const waiter = new Promise((resolve, reject) => {
      this.hashLockWaiters[nItem.hash] = {
        lockReject: reject,
        lockResolve: resolve as () => void,
      }
    })

    // next tick... unlock something, if waiting
    this.mutexTickNext()

    // await for continue
    let error
    try {
      await waiter
    } catch (e) {
      error = e
    }
    delete this.hashLockWaiters[nItem.hash]
    if (error) {
      throw error
    }
  }

  /**
   * Unlock handler
   * @param key
   */
  unlock(hash: string, codeStack?: string) {
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
  unlockForced(filter: (lock: LocalLockItem) => boolean) {
    this.queue.filter(filter).forEach(i => this.unlock(i.hash))
  }

  /**
   * Get info about lock by hash
   * @param hash
   * @returns
   */
  getLockInfo(hash: string): LockItemInfo {
    return getLockInfo(this.queue, hash)
  }

  /**
   * Get lock item
   */
  getLockItem(hash: string): LocalLockItem {
    return this.queue.find(i => i.hash === hash)
  }

  /**
   * Watchdog with phase report
   */
  async watchdog(hash: string, phase?: string, args?: any, codeStack?: string) {
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
   * Set scope rejector
   */
  setScopeRejector(hash: string, rejector: (reason) => void) {
    this.hashLockRejectors[hash] = {
      scopeReject: rejector,
    }
  }

  removeScopeRejector(hash: string) {
    delete this.hashLockRejectors[hash]
  }

  /**
   * Is this clear?
   */
  isClear(): boolean {
    return Object.keys(this.hashLockRejectors).length === 0 && Object.keys(this.hashLockWaiters).length === 0 && this.queue.length === 0
  }

  /************************************
   *
   * Internal methods
   *
   ************************************/

  protected queue: LocalLockItem[] = []
  protected hashLockWaiters: {
    [hash: string]: {
      lockReject?: (err) => void
      lockResolve?: () => void
    }
  } = {}
  protected hashLockRejectors: {
    [hash: string]: {
      scopeReject?: (err) => void
    }
  } = {}

  /**
   * Tick of mutex run, it will continue next mutex(es) in queue
   */
  protected mutexTickNext() {
    const changes: string[] = []

    ;(this.options.algorythm ? this.options.algorythm : Algorythms.simpleQueueSolve)(
      [...this.queue],
      changes,
      this.options.debugDeadEnds
        ? (lock, inCollisionHashes) => {
            if (this.hashLockWaiters[lock.hash]?.lockReject) {
              this.hashLockWaiters[lock.hash].lockReject(
                new MutexError(
                  ERROR.MUTEX_NOTIFIED_EXCEPTION,
                  'Dead end detected, this combination will never be unlocked. See the documentation.',
                  this.getLockInfo(lock.hash),
                  {
                    inCollision: inCollisionHashes.map(hash => sanitizeLock(this.getLockInfo(hash))),
                  },
                ),
              )
            }
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
    if (!this.hashLockWaiters[item.hash]?.lockResolve) {
      throw new Error(`MUTEX item ${item.hash} resolver is not set`)
    }
    this.hashLockWaiters[item.hash].lockResolve()
  }

  /**
   * Lock timeout handler
   */
  protected lockTimeout = (hash: string) => {
    const item = this.queue.find(i => i.hash === hash)
    if (this.hashLockWaiters[item.hash]?.lockReject) {
      this.hashLockWaiters[item.hash].lockReject(new MutexError(ERROR.MUTEX_LOCK_TIMEOUT, `Lock timeout`, this.getLockInfo(item.hash)))
    }

    if (this.hashLockRejectors[item.hash]) {
      if (this.scopesRejector) {
        this.scopesRejector(item, ERROR.MUTEX_LOCK_TIMEOUT, `Lock timeout`)
      }
      this.hashLockRejectors[item.hash].scopeReject(new MutexError(ERROR.MUTEX_LOCK_TIMEOUT, `Lock timeout`, this.getLockInfo(item.hash)))
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
}
