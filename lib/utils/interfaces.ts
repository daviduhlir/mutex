import { MutexCommLayer } from '../components/comm/MutexCommLayer'

/**
 * Configuration
 */
export interface SharedMutexConfiguration {
  /**
   * Default locking time, which will be used for all locks, if it's undefined, it will keep it unset
   */
  defaultMaxLockingTime: number

  /**
   * Timeout behaviour
   */
  continueOnTimeout?: boolean

  /**
   * Communication layer
   */
  communicationLayer: MutexCommLayer | 'IPC' | null
}

/**
 * Single lock configuration
 */
export interface LockConfiguration {
  singleAccess?: boolean
  maxLockingTime?: number
  parents: string[]
  tree: string[]
}

/**
 * Internal lock descriptor
 */
export interface LockDescriptor {
  workerId: number | 'master'
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
}

/**
 * Mutex keey
 */
export type LockKey = string | string[]
