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
  codeStack?: any
  reportedPhases?: LockOperationPhase[]
  status?: LockStatus
}

/**
 * Mutex keey
 */
export type LockKey = string | string[]
