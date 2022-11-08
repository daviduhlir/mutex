"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR = exports.MASTER_ID = exports.ACTION = void 0;
exports.ACTION = {
    LOCK: 'lock',
    UNLOCK: 'unlock',
    VERIFY: 'verify',
    VERIFY_COMPLETE: 'verify-complete',
};
exports.MASTER_ID = 'master';
exports.ERROR = {
    MUTEX_MASTER_NOT_INITIALIZED: 'MUTEX_MASTER_NOT_INITIALIZED',
    MUTEX_REDUNDANT_VERIFICATION: 'MUTEX_REDUNDANT_VERIFICATION',
    MUTEX_LOCK_TIMEOUT: 'MUTEX_LOCK_TIMEOUT',
    MUTEX_NESTED_SCOPES: 'MUTEX_NESTED_SCOPES',
};
//# sourceMappingURL=constants.js.map