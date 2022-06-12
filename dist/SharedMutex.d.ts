/// <reference types="node" />
import { EventEmitter } from 'events';
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
export interface LockDescriptor {
    workerId: number | 'master';
    singleAccess: boolean;
    hash: string;
    key: string;
    maxLockingTime?: number;
}
export interface LocalLockItem extends LockDescriptor {
    timeout?: any;
    isRunning?: boolean;
}
export declare class SharedMutexSynchronizer {
    protected static localLocksQueue: LocalLockItem[];
    protected static alreadyInitialized: boolean;
    static readonly masterHandler: {
        masterIncomingMessage: (message: any) => void;
        emitter: EventEmitter;
    };
    static timeoutHandler: (hash: string) => void;
    static getLockInfo(hash: string): LockDescriptor;
    static resetLockTimeout(hash: string, newMaxLockingTime?: number): void;
    static initializeMaster(): void;
    protected static lock(key: string, workerId: number, singleAccess: boolean, hash: string, maxLockingTime: number): void;
    protected static unlock(hash?: string): void;
    protected static mutexTickNext(): void;
    protected static mutexContinue(workerIitem: LocalLockItem): void;
    protected static masterIncomingMessage(message: any): void;
    protected static reattachMessageHandlers(): void;
    protected static workerUnlockForced(workerId: number): void;
}
