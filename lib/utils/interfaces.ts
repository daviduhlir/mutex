/**
 * Internal lock descriptor
 */
export interface LockDescriptor {
  singleAccess: boolean
  hash: string
  key: string
  maxLockingTime?: number
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
  reject?: (err) => void
  resolve?: () => void
}

/**
 * Mutex keey
 */
export type LockKey = string | string[]
