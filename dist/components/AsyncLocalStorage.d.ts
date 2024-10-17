export declare class AsyncLocalStorageMock<T = any> {
    constructor();
    getStore(): T;
    enterWith(data: any): any;
    run(data: T, fnc: any): Promise<any>;
}
declare let AsyncLocalStorageClass: typeof AsyncLocalStorageMock;
export default AsyncLocalStorageClass;
