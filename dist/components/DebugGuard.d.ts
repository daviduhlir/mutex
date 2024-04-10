import { LocalLockItem } from '../utils/interfaces';
export interface StateInfo {
    opened: boolean;
    key: string;
    hash: string;
    singleAccess: boolean;
    waitingFirstTick: boolean;
    firstAttempTime?: number;
    enteredTime?: number;
    wasBlockedBy?: string[];
    enterStack?: string;
}
export interface DebugGuardOptions {
    logEnterScope: boolean;
    logWaitingOutside: boolean;
    logContinue: boolean;
    logLeave: boolean;
    logDetail: boolean;
    logContinueMinTime: number;
    logLeaveMinTime: number;
}
export declare class DebugGuard {
    static options: DebugGuardOptions;
    static writeFunction: (...msgs: any[]) => void;
    protected static currentStates: {
        [hash: string]: StateInfo;
    };
    static reportDebugInfo(state: string, item: LocalLockItem, codeStack?: string): void;
    protected static getAllRelated(lookupKey: any, originHash?: string): StateInfo[];
}
