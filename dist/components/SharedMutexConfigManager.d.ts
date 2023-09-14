import { MutexCommLayer } from './comm/MutexCommLayer';
import { Awaiter } from '../utils/Awaiter';
import { SharedMutexConfiguration } from '../utils/interfaces';
export declare const defaultConfiguration: SharedMutexConfiguration;
export declare class SharedMutexConfigManager {
    protected static configuration: SharedMutexConfiguration;
    protected static comm: MutexCommLayer;
    protected static initAwaiter: Awaiter;
    static initialize(configuration?: Partial<SharedMutexConfiguration>): boolean;
    static getComm(): Promise<MutexCommLayer>;
    static getConfiguration(): Promise<SharedMutexConfiguration>;
    static getUsingDefaultConfig(): Promise<boolean>;
}
