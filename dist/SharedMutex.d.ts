export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export declare class SharedMutex {
    static lockSingleAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lock(key: string, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler>;
    static unlock(key: string, hash: string): void;
    protected static sendAction(key: string, action: string, hash: string, data?: any): void;
}
