"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYNC_EVENTS = exports.ERROR = exports.VERIFY_MASTER_MAX_TIMEOUT = exports.MASTER_ID = exports.ACTION = void 0;
exports.ACTION = {
    LOCK: 'lock',
    UNLOCK: 'unlock',
    VERIFY: 'verify',
    VERIFY_COMPLETE: 'verify-complete',
};
exports.MASTER_ID = 'master';
exports.VERIFY_MASTER_MAX_TIMEOUT = 1000;
exports.ERROR = {
    MUTEX_MASTER_NOT_INITIALIZED: 'MUTEX_MASTER_NOT_INITIALIZED',
    MUTEX_REDUNDANT_VERIFICATION: 'MUTEX_REDUNDANT_VERIFICATION',
    MUTEX_DIFFERENT_VERSIONS: 'MUTEX_DIFFERENT_VERSIONS',
    MUTEX_LOCK_TIMEOUT: 'MUTEX_LOCK_TIMEOUT',
    MUTEX_NESTED_SCOPES: 'MUTEX_NESTED_SCOPES',
    MUTEX_SAFE_CALLBACK_ALREADY_USED: 'MUTEX_SAFE_CALLBACK_ALREADY_USED',
};
exports.SYNC_EVENTS = {
    LOCK: 'LOCK',
    UNLOCK: 'UNLOCK',
    CONTINUE: 'CONTINUE',
};
//# sourceMappingURL=constants.js.map