import { LockItemInfo } from './interfaces'

export class MutexError extends Error {
  constructor(public readonly key: string, public message: string = '', readonly lock?: LockItemInfo) {
    super(key)
    if (!this.message) {
      this.message = this.key
    } else {
      this.message = `${this.key}: ${this.message}`
    }
    const actualProto = new.target.prototype
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      ;(this as any).__proto__ = actualProto
    }
  }
}
