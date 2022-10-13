/// <reference types="node" />
import { EventEmitter } from 'events';
import { LocalLockItem, LockDescriptor } from './utils/interfaces';
import { SecondarySynchronizer } from './SecondarySynchronizer';
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
