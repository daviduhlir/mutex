export declare class Awaiter {
    protected promise: Promise<any>;
    protected finished: any;
    protected resolver: any;
    constructor();
    wait(): Promise<any>;
    get resolved(): Boolean;
    resolve(): void;
}
