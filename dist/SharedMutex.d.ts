/// <reference types="node" />
import { EventEmitter } from 'events';
import { LocalLockItem, LockDescriptor } from './interfaces';
import { SecondarySynchronizer } from './SecondarySynchronizer';
export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export declare class SharedMutexDecorators {
    static lockSingleAccess(key: string, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockMultiAccess(key: string, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockAccess(key: string, singleAccess?: boolean, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
}
export declare class SharedMutex {
    static lockSingleAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: string, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T>;
    static lock(key: string, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler>;
    static unlock(key: string, hash: string): void;
    protected static sendAction(key: string, action: string, hash: string, data?: any): void;
}
export declare class SharedMutexSynchronizer {
    protected static localLocksQueue: LocalLockItem[];
    protected static alreadyInitialized: boolean;
    protected static secondarySynchronizer: SecondarySynchronizer;
    static setSecondarySynchronizer(secondarySynchronizer: SecondarySynchronizer): void;
    static readonly masterHandler: {
        masterIncomingMessage: (message: any) => void;
        emitter: EventEmitter;
    };
    static timeoutHandler: (hash: string) => void;
    static getLockInfo(hash: string): LockDescriptor;
    static resetLockTimeout(hash: string, newMaxLockingTime?: number): void;
    static initializeMaster(): void;
    protected static lock(item: LocalLockItem): void;
    protected static unlock(hash?: string): void;
    protected static mutexTickNext(): void;
    protected static continue(item: LocalLockItem): void;
    protected static masterIncomingMessage(message: any): void;
    protected static reattachMessageHandlers(): void;
    protected static workerUnlockForced(workerId: number): void;
}
