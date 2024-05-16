/// <reference types="node" />
import { EventEmitter } from 'events';
import { LocalLockItem, LockDescriptor } from '../utils/interfaces';
export declare class SharedMutexSynchronizer {
    static reportDebugInfo: (state: string, item: LocalLockItem, codeStack?: string) => void;
    static debugWithStack: boolean;
    protected static usingCustomConfiguration: boolean;
    static readonly masterHandler: {
        masterIncomingMessage: (message: any) => void;
        emitter: EventEmitter;
    };
    static timeoutHandler: (hash: string) => void;
    static getLockInfo(hash: string): LockDescriptor;
    static resetLockTimeout(hash: string, newMaxLockingTime?: number): void;
    static initializeMaster(): Promise<void>;
    static getLocksCount(): number;
    protected static lock(item: LocalLockItem, codeStack?: string): void;
    protected static unlock(hash?: string, codeStack?: string): void;
    protected static mutexTickNext(): void;
    protected static continue(item: LocalLockItem, originalStack?: string): void;
    protected static handleClusterMessage(worker: any, message: any): void;
    protected static masterIncomingMessage(message: any, worker?: any): void;
    protected static workerUnlockForced(workerId: number): void;
    protected static send(worker: any, message: any): Promise<void>;
}
