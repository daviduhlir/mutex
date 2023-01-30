export declare class MutexError extends Error {
    readonly key: string;
    message: string;
    constructor(key: string, message?: string);
}
