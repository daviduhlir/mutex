import { MutexCommLayer } from '../components/comm/MutexCommLayer';
export interface SharedMutexConfiguration {
    defaultMaxLockingTime: number;
    communicationLayer: MutexCommLayer | 'IPC' | null;
}
export interface LockConfiguration {
    singleAccess?: boolean;
    maxLockingTime?: number;
    parents: string[];
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
    parents?: string[];
    stack?: any;
}
export declare type LockKey = string | string[];
