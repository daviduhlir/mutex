export declare class Awaiter<T = any> {
    protected promise: Promise<T>;
    protected finished: any;
    protected resolver: (result: T) => any;
    protected rejector: (error: Error) => any;
    constructor();
    static wrap<T>(promise: Promise<T>): Awaiter<T>;
    wait(): Promise<T>;
    get resolved(): Boolean;
    resolve(result?: T): void;
    reject(error: Error): void;
}
