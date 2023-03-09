export declare const ACTION: {
    LOCK: string;
    UNLOCK: string;
    VERIFY: string;
    VERIFY_COMPLETE: string;
};
export declare const MASTER_ID = "master";
export declare const VERIFY_MASTER_MAX_TIMEOUT = 1000;
export declare const ERROR: {
    MUTEX_MASTER_NOT_INITIALIZED: string;
    MUTEX_REDUNDANT_VERIFICATION: string;
    MUTEX_DIFFERENT_VERSIONS: string;
    MUTEX_CUSTOM_CONFIGURATION: string;
    MUTEX_LOCK_TIMEOUT: string;
    MUTEX_NESTED_SCOPES: string;
};
export declare const SYNC_EVENTS: {
    LOCK: string;
    UNLOCK: string;
    CONTINUE: string;
};
