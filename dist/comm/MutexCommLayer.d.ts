export declare abstract class MutexCommLayer {
    abstract onClusterMessage(callback: (worker: any, message: any) => void): any;
    abstract onProcessMessage(callback: (message: any) => void): any;
    abstract workerSend(worker: any, message: any): any;
    abstract processSend(message: any): any;
}
