export class MutexError extends Error {
  constructor(public readonly key: string, public readonly message: string = '') {
    super(key)
    const actualProto = new.target.prototype
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      ;(this as any).__proto__ = actualProto
    }
  }
}
