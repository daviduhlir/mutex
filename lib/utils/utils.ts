import { ERROR } from './constants'
import { LocalLockItem, LockItemInfo, LockKey } from './interfaces'
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
    workerId: input.workerId,
    singleAccess: input.singleAccess,
    hash: input.hash,
    key: input.key,
    isRunning: !!input.isRunning,
    parents: input.parents,
    tree: input.tree,
    codeStack: input.codeStack,
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

export function prettyPrintLock(lock: LockItemInfo, spaces: number = 0, printTree?: boolean) {
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

  if (lock.tree.length && printTree) {
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
