"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugGuard = void 0;
const constants_1 = require("../utils/constants");
const utils_1 = require("../utils/utils");
const LOG_PREFIX = `MUTEX_DEBUG`;
class DebugGuard {
    static reportDebugInfo(state, item, codeStack) {
        if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_WAITING) {
            if (!DebugGuard.currentStates[item.hash]) {
                DebugGuard.currentStates[item.hash] = {
                    key: item.key,
                    opened: false,
                    waitingFirstTick: true,
                    firstAttempTime: Date.now(),
                };
            }
            DebugGuard.currentStates[item.hash].enterStack = codeStack;
            setImmediate(() => {
                var _a;
                if (!((_a = DebugGuard.currentStates[item.hash]) === null || _a === void 0 ? void 0 : _a.opened)) {
                    const allRelated = DebugGuard.getAllRelated(item.key, item.hash);
                    DebugGuard.currentStates[item.hash].wasBlockedBy = allRelated.map(i => i.key);
                    if (DebugGuard.options.logWaitingOutside) {
                        DebugGuard.writeFunction(LOG_PREFIX, item.key, `Waiting outside of scope. Posible blockers: `, DebugGuard.currentStates[item.hash].wasBlockedBy, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                            ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                            : undefined);
                    }
                }
                else {
                    DebugGuard.currentStates[item.hash].enteredTime = Date.now();
                    if (DebugGuard.options.logEnterScope) {
                        DebugGuard.writeFunction(LOG_PREFIX, item.key, `Entering scope`);
                    }
                }
                DebugGuard.currentStates[item.hash].waitingFirstTick = false;
            });
        }
        else if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_CONTINUE) {
            if (DebugGuard.currentStates[item.hash]) {
                if (!DebugGuard.currentStates[item.hash].waitingFirstTick) {
                    let waitingTime;
                    if (DebugGuard.currentStates[item.hash]) {
                        waitingTime = Date.now() - DebugGuard.currentStates[item.hash].firstAttempTime;
                        DebugGuard.currentStates[item.hash].enteredTime = Date.now();
                    }
                    if (DebugGuard.options.logContinue && waitingTime > DebugGuard.options.logContinueMinTime) {
                        DebugGuard.writeFunction(LOG_PREFIX, item.key, `Continue into scope (Blocked for ${waitingTime}ms by ${DebugGuard.currentStates[item.hash].wasBlockedBy})`, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                            ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                            : undefined);
                    }
                }
                DebugGuard.currentStates[item.hash].opened = true;
            }
        }
        else if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_EXIT) {
            if (DebugGuard.currentStates[item.hash]) {
                const lockedTime = Date.now() - DebugGuard.currentStates[item.hash].enteredTime;
                if (DebugGuard.options.logLeave && lockedTime > DebugGuard.options.logLeaveMinTime) {
                    DebugGuard.writeFunction(LOG_PREFIX, item.key, `Leaving scope (Locked for ${lockedTime}ms)`, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                        ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                        : undefined);
                }
                delete DebugGuard.currentStates[item.hash];
            }
        }
    }
    static getAllRelated(lookupKey, originHash) {
        return Object.keys(DebugGuard.currentStates).reduce((acc, hash) => {
            const item = DebugGuard.currentStates[hash];
            if (utils_1.keysRelatedMatch(lookupKey, item.key) && hash !== originHash) {
                return [...acc, DebugGuard.currentStates[hash]];
            }
            return acc;
        }, []);
    }
}
exports.DebugGuard = DebugGuard;
DebugGuard.options = {
    logEnterScope: true,
    logWaitingOutside: true,
    logContinue: true,
    logLeave: true,
    logDetail: false,
    logContinueMinTime: 0,
    logLeaveMinTime: 0,
};
DebugGuard.writeFunction = console.log;
DebugGuard.currentStates = {};
//# sourceMappingURL=DebugGuard.js.map