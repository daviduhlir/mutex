export const ACTION = {
  LOCK: 'lock',
  UNLOCK: 'unlock',
  VERIFY: 'verify',
  VERIFY_COMPLETE: 'verify-complete',
}

export const MASTER_ID = 'master'
// max time from fork bootup and verify master response
export const VERIFY_MASTER_MAX_TIMEOUT = 1000

export const ERROR = {
  MUTEX_MASTER_NOT_INITIALIZED: 'MUTEX_MASTER_NOT_INITIALIZED',
  MUTEX_REDUNDANT_VERIFICATION: 'MUTEX_REDUNDANT_VERIFICATION',
  MUTEX_LOCK_TIMEOUT: 'MUTEX_LOCK_TIMEOUT',
  MUTEX_NESTED_SCOPES: 'MUTEX_NESTED_SCOPES',
}

export const SYNC_EVENTS = {
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  CONTINUE: 'CONTINUE',
}
