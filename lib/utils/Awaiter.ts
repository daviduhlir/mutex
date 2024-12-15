/**
 * Awaiter, that can await for some action done outside of scope
 */
export class Awaiter<T = any> {
  protected promise: Promise<T>
  protected result: { value?: any; error?: any } = null
  protected timeoutHandler
  protected resolver: (result: T) => any
  protected rejector: (error: Error) => any

  constructor(timeout?: number, customTimeout?: () => Error) {
    this.promise = new Promise((resolve, reject) => {
      this.resolver = resolve
      this.rejector = reject
    })
    this.watchdog(timeout, customTimeout)
  }

  /**
   * Starts watchdog
   */
  watchdog(timeout?: number, customTimeout?: () => Error) {
    clearTimeout(this.timeoutHandler)
    if (timeout) {
      this.timeoutHandler = setTimeout(() => this.reject(customTimeout ? customTimeout() : new Error(`Awaiter rejected after timeout`)), timeout)
    }
  }

  /**
   * Wrap promise by awaiter
   */
  static wrap<T>(promise: Promise<T>): Awaiter<T> {
    const awaiter = new Awaiter<T>()
    promise.then(
      result => awaiter.resolve(result),
      error => awaiter.reject(error),
    )
    return awaiter
  }

  /**
   * Wait it until it will be resolved.
   *
   * eg. await waiter.wait()
   */
  async wait() {
    if (this.result) {
      if (this.result.error) {
        throw this.result.error
      }
      return this.result.value
    }
    return this.promise
  }

  /**
   * Get if it's already resolved
   */
  get resolved(): Boolean {
    return !!this.result
  }

  /**
   * Resolved it, and go forward
   */
  resolve(value?: T) {
    this.result = {
      value,
    }
    if (this.resolver) {
      this.resolver(value)
    }
  }

  /**
   * Reject it, and go forward
   */
  reject(error: Error) {
    this.result = {
      error,
    }
    if (this.rejector) {
      this.rejector(error)
    }
  }
}
