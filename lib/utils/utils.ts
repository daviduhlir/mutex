import { ERROR, REJECTION_REASON } from './constants'
import { LocalLockItem, LockItemInfo, LockKey, MutexStackItem } from './interfaces'
import { MutexError } from './MutexError'

/**
 * Generates random alphabetic and numeric hash
 */
export function randomHash(): string {
  return [...Array(10)]
    .map(x => 0)
    .map(() => Math.random().toString(36).slice(2))
    .join('')
}

/**
 * If key is children of parental key
 */
export function isChildOf(key: string, parentKey: string): boolean {
  const keyParts = key.split('/').filter(Boolean)
  const parentKeyParts = parentKey.split('/').filter(Boolean)

  if (keyParts.length >= parentKeyParts.length) {
    return false
  }

  for (let i = 0; i < keyParts.length; i++) {
    if (keyParts[i] !== parentKeyParts[i]) {
      return false
    }
  }

  return true
}

/**
 * Match two keys, if it's same, parental or child of second key
 */
export function keysRelatedMatch(key1: string | string[], key2: string | string[]): boolean {
  // try if it's child or parent
  const key1Parts = (Array.isArray(key1) ? key1 : key1.split('/')).filter(Boolean)
  const key2Parts = (Array.isArray(key2) ? key2 : key2.split('/')).filter(Boolean)
  for (let i = 0; i < Math.min(key1Parts.length, key2Parts.length); i++) {
    if (key1Parts[i] !== key2Parts[i]) {
      return false
    }
  }
  return true
}

/**
 * Sanitize lock structure
 */
export function sanitizeLock(input: any): LocalLockItem {
  return {
    singleAccess: input.singleAccess,
    hash: input.hash,
    key: input.key,
    isRunning: !!input.isRunning,
    parents: input.parents,
    tree: input.tree,
    codeStack: input.codeStack,
    workerId: input.workerId,
    ...(input.maxLockingTime ? { maxLockingTime: input.maxLockingTime } : {}),
    ...(input.timeout ? { timeout: input.timeout } : {}),
  }
}

/**
 * Parse key of lock
 */
export function parseLockKey(key: LockKey): string {
  return (
    '/' +
    (Array.isArray(key) ? key.join('/') : key)
      .split('/')
      .filter(i => !!i)
      .join('/')
  )
}

export function prettyPrintLock(inputLock: LockItemInfo | MutexStackItem, spaces: number = 0, printTree?: boolean) {
  const lock: LockItemInfo = inputLock as any
  const spacesString = new Array(spaces).fill('  ').join('')
  console.log(
    `${spacesString}\x1b[1m${lock.singleAccess ? 'Single access' : 'Multi access'} key ${lock.key} ${lock.isRunning ? '(currently openned)' : ''}${
      lock.timing?.locked ? ` Locked at ${new Date(lock.timing.locked).toISOString()}` : ''
    }\x1b[0m`,
  )
  if (lock.codeStack) {
    console.log(
      lock.codeStack
        .split('\n')
        .map(l => `\x1b[34m${spacesString}  ${l}\x1b[0m`)
        .join('\n'),
    )
  }

  if (lock.tree?.length && printTree) {
    console.log(`${spacesString}  Lock tree:`)
    lock.tree.forEach(parent => prettyPrintLock(parent, spaces + 2))
  }
}

export function prettyPrintError(e: MutexError) {
  if (e instanceof MutexError) {
    console.log(`\x1b[41mMUTEX ERROR ${e.message}\x1b[0m`)
    prettyPrintLock(e.lock, 1, true)
    if (e.details?.inCollision) {
      console.log('\x1b[31m  This scope is in collision with:\x1b[0m')
      e.details?.inCollision.forEach(item => prettyPrintLock(item, 2, true))
    }
  }
}

export function getLockInfo(queue: LocalLockItem[], hash: string) {
  const item = queue.find(i => i.hash === hash)
  if (!item) {
    return null
  }
  const blockedBy = queue
    .filter(l => l.isRunning && keysRelatedMatch(l.key, item.key))
    .filter(l => l.hash !== hash)
    .map(item => sanitizeLock(item))

  return {
    singleAccess: item.singleAccess,
    hash: item.hash,
    key: item.key,
    isRunning: item.isRunning,
    codeStack: item.codeStack,
    blockedBy,
    reportedPhases: item.reportedPhases,
    tree: item.tree ? item.tree.map(l => getLockInfo(queue, l)) : undefined,
    parents: item.parents ? item.parents.map(l => getLockInfo(queue, l)) : undefined,
    workerId: item.workerId,
    timing: {
      locked: item.timing.locked,
      opened: item.timing.opened,
    },
  }
}

/**
 * Search all blocking items
 */
export function searchBlockers(item: MutexStackItem, queue: MutexStackItem[], acc = []) {
  for (const i of queue) {
    if (i.running && i.id === item.id && keysRelatedMatch(i.key, item.key) && (item.singleAccess || (!item.singleAccess && i.singleAccess))) {
      if (acc.findIndex(accI => accI.hash === i.hash) === -1 && item.tree.findIndex(treeI => treeI.hash === i.hash) === -1) {
        acc.push(i)
      }
    }
  }
  return acc
}

/**
 * Search deadlock in it
 */
export function searchKiller(myStackItem: MutexStackItem, queue: MutexStackItem[]) {
  return searchBlockers(myStackItem, queue).find(blocker => {
    return queue.find(
      child =>
        // is block in treee
        child.tree.find(it => it.hash === blocker.hash) &&
        // is it related and running
        myStackItem.tree.find(myParent => myParent.running && child.id === myParent.id && keysRelatedMatch(child.key, myParent.key)),
    )
  })
}

/**
 * Dead end retrier will helps with handling dead locks by retrying it after some time,
 * this requires to have deadEnd detection on
 */
export interface DeadEndRetrierOptions {
  attemps: number
  delay: number
  cleanupCallback?: (e: MutexError) => void
}
export const deadEndRetrierDefaultOptions: DeadEndRetrierOptions = {
  attemps: 5,
  delay: 200,
}
export async function deadEndRetrier<T>(handler: () => Promise<T>, options: Partial<DeadEndRetrierOptions> = null): Promise<T> {
  const mergedOptions = {
    ...deadEndRetrierDefaultOptions,
    ...options,
  }
  for (let i = 0; i < mergedOptions.attemps; i++) {
    try {
      return await handler()
    } catch (e) {
      if (e instanceof MutexError && e.key === ERROR.MUTEX_NOTIFIED_EXCEPTION && e.details.reason === REJECTION_REASON.DEAD_END) {
        if (mergedOptions.cleanupCallback) {
          mergedOptions.cleanupCallback(e)
        }
        await new Promise(resolve => setTimeout(resolve, mergedOptions.delay))
        continue
      }
      throw e
    }
  }
}
