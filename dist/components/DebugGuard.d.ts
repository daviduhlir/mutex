import { LocalLockItem } from '../utils/interfaces';
export interface StateInfo {
    opened: boolean;
    key: string;
    waitingFirstTick: boolean;
}
export declare class DebugGuard {
    static writeFunction: (...msgs: any[]) => void;
    protected static currentStates: {
        [hash: string]: StateInfo;
    };
    static reportDebugInfo(state: string, item: LocalLockItem): void;
    protected static getAllRelated(lookupKey: any, originHash?: string): StateInfo[];
}
