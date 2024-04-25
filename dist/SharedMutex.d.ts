import { LockConfiguration, LockKey, SharedMutexConfiguration } from './utils/interfaces';
import { Awaiter } from './utils/Awaiter';
import { MutexSafeCallbackHandler } from './components/MutexSafeCallbackHandler';
export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export declare class SharedMutex {
    protected static waitingMessagesHandlers: {
        resolve: (message: any) => void;
        hash: string;
    }[];
    protected static attached: boolean;
    protected static masterVerificationWaiter: Awaiter;
    protected static masterVerifiedTimeout: any;
    protected static masterVerificationSent: boolean;
    protected static stackStorage: import("./components/AsyncLocalStorage").AsyncLocalStorageMock<{
        key: string;
        singleAccess: boolean;
    }[]>;
    static lockSingleAccess<T>(key: LockKey, handler: (() => Promise<T>) | MutexSafeCallbackHandler<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: LockKey, handler: (() => Promise<T>) | MutexSafeCallbackHandler<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: LockKey, handler: (() => Promise<T>) | MutexSafeCallbackHandler<T>, singleAccess?: boolean, maxLockingTime?: number, codeStack?: string): Promise<T>;
    static lock(key: LockKey, config: LockConfiguration, codeStack?: string): Promise<SharedMutexUnlockHandler>;
    static unlock(key: LockKey, hash: string): void;
    static initialize(configuration?: Partial<SharedMutexConfiguration>): Promise<void>;
    protected static sendAction(key: string, action: string, hash: string, data?: any, codeStack?: any): Promise<void>;
    protected static handleMessage(message: any): void;
    protected static verifyMaster(): Promise<any>;
}
