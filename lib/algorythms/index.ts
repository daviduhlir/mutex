import { LocalLockItem } from '../utils/interfaces'
import { keysRelatedMatch, singleKeysRelatedMatch } from '../utils/utils'

export class Algorythms {
  static simpleQueueSolve(queue: LocalLockItem[], changes: string[], deadEndNotify?: (lock: LocalLockItem, inCollisionHashes: string[]) => void) {
    let deadEndnalyzis = []
    for (let i = 0; i < queue.length; i++) {
      const lock = queue[i]
      if (lock.isRunning) {
        continue
      }

      // all running locks
      const foundRunningLocks = queue.filter(l => l.isRunning && keysRelatedMatch(lock.key, l.key))
      const allRunningKeys = foundRunningLocks.reduce((acc, lock) => [...acc, ...lock.key], [])

      // check all keys
      const allKeysAvailable = lock.key.every(key => !allRunningKeys.some(runningKey => singleKeysRelatedMatch(key, runningKey)))

      // parent tree check
      const isParentTreeRunning = lock.parents?.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash))

      if (lock.singleAccess) {
        if (allKeysAvailable || (isParentTreeRunning && foundRunningLocks.every(l => lock.parents.includes(l.hash)))) {
          changes.push(lock.hash)
          lock.isRunning = true
        } else {
          const blockingLocks = foundRunningLocks.filter(l => !lock.parents?.includes(l.hash))
          if (deadEndNotify) {
            deadEndnalyzis.push({
              hash: lock.hash,
              tree: lock.tree,
              blockedBy: blockingLocks.map(l => l.hash),
            })
          }
        }
      } else {
        if (foundRunningLocks.every(lock => !lock.singleAccess) || isParentTreeRunning) {
          changes.push(lock.hash)
          lock.isRunning = true
        } else {
          const blockingLocks = foundRunningLocks.filter(l => !lock.parents?.includes(l.hash))
          if (deadEndNotify) {
            deadEndnalyzis.push({
              hash: lock.hash,
              tree: lock.tree,
              blockedBy: blockingLocks.map(l => l.hash),
            })
          }
        }
      }
    }

    // deadlocks
    if (deadEndNotify) {
      for (const item of deadEndnalyzis) {
        const blockingItems = deadEndnalyzis.filter(l => l.blockedBy.some(b => item.tree.includes(b)))
        const blockingMe = blockingItems.filter(l => l.tree.some(b => item.blockedBy.includes(b)))
        if (blockingMe.length) {
          const lock = queue.find(i => i.hash === item.hash)
          deadEndNotify(
            lock,
            blockingMe.map(l => l.hash),
          )
        }
      }
    }
  }
}
