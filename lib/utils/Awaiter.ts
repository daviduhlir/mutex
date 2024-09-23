/**
 * Awaiter, that can await for some action done outside of scope
 */
export class Awaiter<T = any> {
  protected promise: Promise<T>
  protected finished
  protected resolver: (result: T) => any
  protected rejector: (error: Error) => any

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolver = resolve
      this.rejector = reject
    })
  }

  /**
   * Wrap promise by awaiter
   */
  public static wrap<T>(promise: Promise<T>): Awaiter<T> {
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
  public async wait() {
    if (this.finished) {
      return
    }
    return this.promise
  }

  /**
   * Get if it's already resolved
   */
  public get resolved(): Boolean {
    return this.finished
  }

  /**
   * Resolved it, and go forward
   */
  public resolve(result?: T) {
    this.finished = true
    if (this.resolver) {
      this.resolver(result)
    }
  }

  /**
   * Reject it, and go forward
   */
  public reject(error: Error) {
    this.finished = true
    if (this.rejector) {
      this.rejector(error)
    }
  }
}
