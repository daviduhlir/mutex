export declare class MutexError extends Error {
    readonly key: string;
    readonly message: string;
    constructor(key: string, message?: string);
}
