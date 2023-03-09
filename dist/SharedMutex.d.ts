import { LockKey, SharedMutexConfiguration } from './utils/interfaces';
import { Awaiter } from './utils/Awaiter';
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
    forceInstantContinue?: boolean;
}
export declare class SharedMutex {
    protected static waitingMessagesHandlers: {
        resolve: (message: any) => void;
        hash: string;
    }[];
    protected static attached: boolean;
    protected static masterVerificationWaiter: Awaiter;
    protected static masterVerifiedTimeout: any;
    protected static stackStorage: import("./components/AsyncLocalStorage").AsyncLocalStorageMock<{
        key: string;
        singleAccess: boolean;
    }[]>;
    static lockSingleAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: LockKey, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: LockKey, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T>;
    static lock(key: LockKey, config: LockConfiguration): Promise<SharedMutexUnlockHandler>;
    static unlock(key: LockKey, hash: string): void;
    static attachHandler(): Promise<void>;
    static initialize(configuration?: Partial<SharedMutexConfiguration>): Promise<void>;
    protected static sendAction(key: string, action: string, hash: string, data?: any): Promise<void>;
    protected static handleMessage(message: any): void;
    protected static verifyMaster(): Promise<void>;
}
