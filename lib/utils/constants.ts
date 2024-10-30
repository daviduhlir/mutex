export const ACTION = {
  LOCK: 'lock',
  UNLOCK: 'unlock',
  VERIFY: 'verify',
  CONTINUE: 'continue',
  VERIFY_COMPLETE: 'verify-complete',
  WATCHDOG_REPORT: 'watchdog-report',
  WATCHDOG_STATUS: 'watchdog-status',
}

export const MASTER_ID = 'master'
// max time from fork bootup and verify master response
export const VERIFY_MASTER_MAX_TIMEOUT = 1000

export const ERROR = {
  MUTEX_MASTER_NOT_INITIALIZED: 'MUTEX_MASTER_NOT_INITIALIZED',
  MUTEX_REDUNDANT_VERIFICATION: 'MUTEX_REDUNDANT_VERIFICATION',
  MUTEX_DIFFERENT_VERSIONS: 'MUTEX_DIFFERENT_VERSIONS',
  MUTEX_CUSTOM_CONFIGURATION: 'MUTEX_CUSTOM_CONFIGURATION',
  MUTEX_LOCK_TIMEOUT: 'MUTEX_LOCK_TIMEOUT',
  MUTEX_SAFE_CALLBACK_ALREADY_USED: 'MUTEX_SAFE_CALLBACK_ALREADY_USED',
  MUTEX_WATCHDOG_REJECTION: 'MUTEX_WATCHDOG_REJECTION',
}

export const SYNC_EVENTS = {
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  CONTINUE: 'CONTINUE',
}

export const DEBUG_INFO_REPORTS = {
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
  SCOPE_WAITING: 'SCOPE_WAITING',
  SCOPE_EXIT: 'SCOPE_EXIT',
  SCOPE_CONTINUE: 'SCOPE_CONTINUE',
}
