import { MutexCommLayer } from '../components/comm/MutexCommLayer';
export interface SharedMutexConfiguration {
    strictMode: boolean;
    defaultMaxLockingTime: number;
    communicationLayer?: MutexCommLayer;
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
}
export declare type LockKey = string | string[];
