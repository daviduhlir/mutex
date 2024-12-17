/**
 * Internal lock descriptor
 */
export interface LockDescriptor {
  singleAccess: boolean
  hash: string
  key: string
  maxLockingTime?: number
  workerId: number | undefined
}

export interface LockItemInfo extends LockDescriptor {
  isRunning: boolean
  blockedBy: LockDescriptor[]
  codeStack?: any
  reportedPhases?: LockOperationPhase[]
  parents?: LockItemInfo[]
  tree?: LockItemInfo[]
  timing?: {
    locked?: number
    opened?: number
  }
}

export interface LockOperationPhase {
  phase?: string
  codeStack?: string
  args?: any
}

export type LockStatus = undefined | 'timeouted' | 'rejected' | 'finished'

/**
 * Local lock item in queue
 */
export interface LocalLockItem extends LockDescriptor {
  timeout?: any
  isRunning?: boolean
  parents?: string[]
  tree?: string[]
  codeStack?: any
  reportedPhases?: LockOperationPhase[]
  status?: LockStatus
  timing?: {
    locked?: number
    opened?: number
  }
}

/**
 * Mutex keey
 */
export type LockKey = string | string[]

/**
 * Local stack item
 */
export interface MutexStackItem {
  hash: string
  key: string
  singleAccess: boolean
  id: string
  running?: boolean
  tree: MutexStackItem[]
}
