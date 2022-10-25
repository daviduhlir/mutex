import { LockKey } from './utils/interfaces';
export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export interface LockConfiguration {
    strictMode?: boolean;
    singleAccess?: boolean;
    maxLockingTime?: number;
}
export declare class SharedMutex {
    static strictMode: boolean;
    protected static waitingMessagesHandlers: {
        resolve: (message: any) => void;
        hash: string;
    }[];
    protected static attached: boolean;
    static stack: {
        key: string;
        singleAccess: boolean;
    }[];
    static lockSingleAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: LockKey, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T>;
    static lock(key: LockKey, config: LockConfiguration): Promise<SharedMutexUnlockHandler>;
    static unlock(key: LockKey, hash: string): void;
    protected static sendAction(key: string, action: string, hash: string, data?: any): void;
    static attachHandler(): void;
    protected static handleMessage(message: any): void;
    protected static warning(message: string): void;
}
