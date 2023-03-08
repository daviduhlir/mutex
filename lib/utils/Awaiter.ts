/**
 * Awaiter, that can await for some action done outside of scope
 */
export class Awaiter {
  protected promise: Promise<any>
  protected finished
  protected resolver

  constructor() {
    this.promise = new Promise(resolve => (this.resolver = resolve))
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
  public resolve() {
    this.finished = true
    if (this.resolver) {
      this.resolver()
    }
  }
}
