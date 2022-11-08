/// <reference types="node" />
import { LocalLockItem } from './utils/interfaces';
import { EventEmitter } from 'events';
export declare class SecondarySynchronizer extends EventEmitter {
    lock(item: LocalLockItem): void;
    unlock(hash: string): void;
    continue(item: LocalLockItem): void;
    get isArbitter(): boolean;
}
