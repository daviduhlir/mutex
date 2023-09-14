export declare const __mutexSafeCallbackInjector: unique symbol;
export declare const __mutexSafeCallbackDispose: unique symbol;
export declare class MutexSafeCallbackHandler<T> {
    fnc: () => Promise<T>;
    protected timeout?: number;
    protected onStartCallback?: () => void;
    protected unlockCallback: () => void;
    protected timeoutHandler: any;
    constructor(fnc: () => Promise<T>, timeout?: number, onStartCallback?: () => void);
    unlock(): void;
    [__mutexSafeCallbackInjector]: (callback: () => void) => void;
    [__mutexSafeCallbackDispose]: () => void;
}
