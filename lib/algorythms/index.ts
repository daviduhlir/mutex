import { LocalLockItem } from '../utils/interfaces'
import { keysRelatedMatch } from '../utils/utils'

export class Algorythms {
  static simpleQueueSolve(queue: LocalLockItem[], changes: string[], deadEndNotify: (lock: LocalLockItem, inCollisionHashes: string[]) => void) {
    let deadEndnalyzis = []
    for (let i = 0; i < queue.length; i++) {
      const lock = queue[i]
      if (lock.isRunning) {
        continue
      }

      const foundRunningLocks = queue.filter(l => l.isRunning && keysRelatedMatch(l.key, lock.key))
      const isParentTreeRunning = lock.parents?.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash))

      // if single access group is on top, break it anyway
      if (lock.singleAccess) {
        if (foundRunningLocks.length === 0 || (isParentTreeRunning && foundRunningLocks.filter(l => !lock.parents.includes(l.hash)).length === 0)) {
          changes.push(lock.hash)
          lock.isRunning = true
        } else {
          const outterLocks = foundRunningLocks.filter(l => !lock.parents.includes(l.hash))

          if (deadEndNotify) {
            deadEndnalyzis.push({
              hash: lock.hash,
              tree: lock.tree,
              blockedBy: outterLocks.map(l => l.hash),
            })
          }
        }
      } else {
        if (foundRunningLocks.every(lock => !lock.singleAccess) || isParentTreeRunning) {
          changes.push(lock.hash)
          lock.isRunning = true
        } else {
          const outterLocks = foundRunningLocks.filter(l => !lock.parents.includes(l.hash))

          if (deadEndNotify) {
            deadEndnalyzis.push({
              hash: lock.hash,
              tree: lock.tree,
              blockedBy: outterLocks.map(l => l.hash),
            })
          }
        }
      }
    }

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
