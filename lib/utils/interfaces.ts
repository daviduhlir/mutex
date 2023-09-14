import { MutexCommLayer } from '../components/comm/MutexCommLayer'

/**
 * Configuration
 */
export interface SharedMutexConfiguration {
  /**
   * Strict mode, how to deal with nested locks
   */
  strictMode: boolean
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
  strictMode?: boolean
  singleAccess?: boolean
  maxLockingTime?: number
  forceInstantContinue?: boolean
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

/**
 * Local lock item in queue
 */
export interface LocalLockItem extends LockDescriptor {
  timeout?: any
  isRunning?: boolean
  forceInstantContinue?: boolean
}

/**
 * Mutex keey
 */
export type LockKey = string | string[]
