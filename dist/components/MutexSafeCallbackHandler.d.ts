export declare const __mutexSafeCallbackInjector: unique symbol;
export declare const __mutexSafeCallbackDispose: unique symbol;
export declare class MutexSafeCallbackHandler<T> {
    fnc: () => Promise<T>;
    protected timeout?: number;
    protected unlockCallback: () => void;
    protected timeoutHandler: any;
    constructor(fnc: () => Promise<T>, timeout?: number);
    unlock(): void;
    [__mutexSafeCallbackInjector](callback: () => void): void;
    [__mutexSafeCallbackDispose](): void;
}
