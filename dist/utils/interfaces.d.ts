import { MutexCommLayer } from '../components/comm/MutexCommLayer';
export interface SharedMutexConfiguration {
    strictMode: boolean;
    defaultMaxLockingTime: number;
    communicationLayer: MutexCommLayer | 'IPC' | null;
}
export interface LockConfiguration {
    strictMode?: boolean;
    singleAccess?: boolean;
    maxLockingTime?: number;
    forceInstantContinue?: boolean;
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
    forceInstantContinue?: boolean;
    stack?: any;
}
export declare type LockKey = string | string[];
