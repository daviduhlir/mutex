export interface LockDescriptor {
  workerId: number | 'master'
  singleAccess: boolean
  hash: string
  key: string
  maxLockingTime?: number
}

export interface LocalLockItem extends LockDescriptor {
  timeout?: any
  isRunning?: boolean
}

export type LockKey = string | string[]
