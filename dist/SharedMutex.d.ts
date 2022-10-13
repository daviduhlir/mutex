import { LockKey } from './utils/interfaces';
export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export declare class SharedMutex {
    static lockSingleAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: LockKey, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T>;
    static lock(key: LockKey, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler>;
    static unlock(key: LockKey, hash: string): void;
    protected static sendAction(key: string, action: string, hash: string, data?: any): void;
}
