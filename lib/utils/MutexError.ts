export class MutexError extends Error {
  constructor(public readonly key: string, public message: string = '') {
    super(key)
    if (!this.message) {
      this.message = this.key
    }
    const actualProto = new.target.prototype
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      ;(this as any).__proto__ = actualProto
    }
  }
}
