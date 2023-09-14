import { SharedMutex } from '../SharedMutex'
import { LockKey } from '../utils/interfaces'

/**
 * Shared mutex decorator utils class
 */
export class SharedMutexDecorators {
  /**
   * Lock single access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockSingleAccess(key: LockKey, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccess(key, true, maxLockingTime)
  }

  /**
   * Lock multi access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockMultiAccess(key: LockKey, maxLockingTime?: number) {
    return SharedMutexDecorators.lockAccess(key, false, maxLockingTime)
  }

  /**
   * Lock access decorator
   * @param key
   * @param singleAccess
   * @param maxLockingTime
   */
  static lockAccess(key: LockKey, singleAccess?: boolean, maxLockingTime?: number) {
    return (_target, _name, descriptor) => {
      if (typeof descriptor.value === 'function') {
        const original = descriptor.value
        descriptor.value = function (...args) {
          return SharedMutex.lockAccess(key, () => original(...args), singleAccess, maxLockingTime)
        }
      }
      return descriptor
    }
  }
}
