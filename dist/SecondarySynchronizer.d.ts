/// <reference types="node" />
import { LocalLockItem } from './interfaces';
import { EventEmitter } from 'events';
export declare const SYNC_EVENTS: {
    LOCK: string;
    UNLOCK: string;
    CONTINUE: string;
};
export declare class SecondarySynchronizer extends EventEmitter {
    lock(item: LocalLockItem): void;
    unlock(hash: string): void;
    continue(item: LocalLockItem): void;
    get isArbitter(): boolean;
}
