import { LockKey } from './utils/interfaces';
export declare class SharedMutexDecorators {
    static lockSingleAccess(key: LockKey, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockMultiAccess(key: LockKey, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockAccess(key: LockKey, singleAccess?: boolean, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
}
