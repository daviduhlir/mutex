import { LocalLockItem, LockKey } from './interfaces'

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
