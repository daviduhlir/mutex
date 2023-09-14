import { MutexError } from '../utils/MutexError'
import { ERROR } from '../utils/constants'

export const __mutexSafeCallbackInjector = Symbol()
export const __mutexSafeCallbackDispose = Symbol()

/**
 * Safe callback class to be able unlock too long waiting promise without standart mutex timeout handler
 * You can also provide your timeout to reject this call automaticaly. This timeout must be less then mutex timeout to be applyed
 */
export class MutexSafeCallbackHandler<T> {
  protected unlockCallback: () => void
  protected timeoutHandler

  constructor(public fnc: () => Promise<T>, protected timeout?: number) {}

  /**
   * Reject this callback
   */
  unlock() {
    clearTimeout(this.timeoutHandler)
    this.timeoutHandler = null
    if (this.unlockCallback) {
      this.unlockCallback()
    }
  }

  [__mutexSafeCallbackInjector](callback: () => void) {
    if (this.unlockCallback) {
      throw new MutexError(ERROR.MUTEX_SAFE_CALLBACK_ALREADY_USED)
    }
    this.unlockCallback = callback

    if (this.timeout) {
      this.timeoutHandler = setTimeout(this.unlock, this.timeout)
    }
  }

  [__mutexSafeCallbackDispose]() {
    clearTimeout(this.timeoutHandler)
    this.timeoutHandler = null
    this.unlockCallback = null
  }
}
