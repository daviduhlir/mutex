import { LocalLockItem, LockKey } from './interfaces'

export function randomHash(): string {
  return [...Array(10)]
    .map(x => 0)
    .map(() => Math.random().toString(36).slice(2))
    .join('')
}

export function getAllKeys(key: string): string[] {
  return key
    .split('/')
    .filter(Boolean)
    .reduce<string[]>((acc, item, index, array) => {
      return [...acc, array.slice(0, index + 1).join('/')]
    }, [])
}

export function isChildOf(key: string, parentKey: string): boolean {
  const childKeys = getAllKeys(key)
  const index = childKeys.indexOf(parentKey)
  if (index !== -1 && index !== childKeys.length - 1) {
    return true
  }
  return false
}

export function sanitizeLock(input: any): LocalLockItem {
  return {
    workerId: input.workerId,
    singleAccess: input.singleAccess,
    hash: input.hash,
    key: input.key,
    isRunning: !!input.isRunning,
    ...(input.maxLockingTime ? { maxLockingTime: input.maxLockingTime } : {}),
    ...(input.timeout ? { timeout: input.timeout } : {}),
  }
}

export function parseLockKey(key: LockKey): string {
  return (Array.isArray(key) ? key.join('/') : key)
    .split('/')
    .filter(i => !!i)
    .join('/')
}
