import { MutexCommLayer } from './MutexCommLayer';
export declare class IPCMutexCommLayer extends MutexCommLayer {
    onClusterMessage(callback: (worker: any, message: any) => void): void;
    onProcessMessage(callback: (message: any) => void): void;
    workerSend(worker: any, message: any): void;
    processSend(message: any): void;
}
