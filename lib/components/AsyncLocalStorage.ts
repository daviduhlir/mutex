// AsyncLocalStorage mock
export class AsyncLocalStorageMock<T = any> {
  constructor() {}
  getStore(): T {
    return undefined
  }
  async run(data: T, fnc) {
    return fnc()
  }
}

let AsyncLocalStorageClass = AsyncLocalStorageMock

try {
  AsyncLocalStorageClass = require('async_hooks').AsyncLocalStorage
} catch (e) {}

export default AsyncLocalStorageClass
