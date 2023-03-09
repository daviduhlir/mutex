export declare class MutexCommLayer {
    onClusterMessage(callback: (worker: any, message: any) => void): void;
    onProcessMessage(callback: (message: any) => void): void;
    workerSend(worker: any, message: any): void;
    processSend(message: any): void;
}
