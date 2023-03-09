import { LocalLockItem } from './interfaces'

const LOCAL_LOCKS_QUEUE_PROPERTY = '__sharedMutex_localLocksQueue__'
const ALREADY_INITIALIZED_PROPERTY = '__sharedMutex_initialized__'

/**
 * Local locks queue storage to prevent more than one instance globaly
 */
export class MutexGlobalStorage {
  // get internal locks array
  public static getLocalLocksQueue(): LocalLockItem[] {
    if (!global[LOCAL_LOCKS_QUEUE_PROPERTY]) {
      global[LOCAL_LOCKS_QUEUE_PROPERTY] = []
    }
    return global[LOCAL_LOCKS_QUEUE_PROPERTY]
  }

  // set internal locks array
  public static setLocalLocksQueue(items: LocalLockItem[]) {
    global[LOCAL_LOCKS_QUEUE_PROPERTY] = items
  }

  // get internal locks array
  public static getInitialized(): boolean {
    return !!global[ALREADY_INITIALIZED_PROPERTY]
  }

  // set internal locks array
  public static setInitialized() {
    global[ALREADY_INITIALIZED_PROPERTY] = true
  }
}
