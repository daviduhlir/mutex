export declare class SharedMutexUnlockHandler {
    readonly key: string;
    readonly hash: string;
    constructor(key: string, hash: string);
    unlock(): void;
}
export declare class SharedMutexDecorators {
    static lockSingleAccessDecorator(key: string, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockMultiAccessDecorator(key: string, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
    static lockAccessDecorator(key: string, singleAccess?: boolean, maxLockingTime?: number): (_target: any, _name: any, descriptor: any) => any;
}
export declare class SharedMutex {
    static lockSingleAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockMultiAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T>;
    static lockAccess<T>(key: string, fnc: () => Promise<T>, singleAccess?: boolean, maxLockingTime?: number): Promise<T>;
    static lock(key: string, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler>;
    static unlock(key: string, hash: string): void;
    protected static sendAction(key: string, action: string, hash: string, data?: any): void;
}
