import { LocalLockItem, LockKey } from './interfaces';
export declare function randomHash(): string;
export declare function isChildOf(key: string, parentKey: string): boolean;
export declare function keysRelatedMatch(key1: string, key2: string): boolean;
export declare function sanitizeLock(input: any): LocalLockItem;
export declare function parseLockKey(key: LockKey): string;
