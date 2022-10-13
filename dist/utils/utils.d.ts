import { LocalLockItem, LockKey } from './interfaces';
export declare function randomHash(): string;
export declare function getAllKeys(key: string): string[];
export declare function isChildOf(key: string, parentKey: string): boolean;
export declare function sanitizeLock(input: any): LocalLockItem;
export declare function parseLockKey(key: LockKey): string;
