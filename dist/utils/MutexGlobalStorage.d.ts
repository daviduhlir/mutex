import { LocalLockItem } from './interfaces';
export declare class MutexGlobalStorage {
    static getLocalLocksQueue(): LocalLockItem[];
    static setLocalLocksQueue(items: LocalLockItem[]): void;
    static getInitialized(): boolean;
    static setInitialized(): void;
}
