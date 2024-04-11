"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugGuard = void 0;
const constants_1 = require("../utils/constants");
const utils_1 = require("../utils/utils");
const LOG_PREFIX = `MUTEX_DEBUG`;
class DebugGuard {
    static reportDebugInfo(state, item, codeStack) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_WAITING) {
            if (!DebugGuard.currentStates[item.hash]) {
                DebugGuard.currentStates[item.hash] = {
                    key: item.key,
                    hash: item.hash,
                    singleAccess: item.singleAccess,
                    opened: false,
                    waitingFirstTick: true,
                    firstAttempTime: Date.now(),
                };
            }
            DebugGuard.currentStates[item.hash].enterStack = codeStack;
            setImmediate(() => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (!((_a = DebugGuard.currentStates[item.hash]) === null || _a === void 0 ? void 0 : _a.opened)) {
                    const allRelated = DebugGuard.getAllRelated(item.key, item.hash);
                    if (DebugGuard.currentStates[item.hash]) {
                        DebugGuard.currentStates[item.hash].wasBlockedBy = allRelated.map(i => i.key);
                    }
                    if (DebugGuard.options.logWaitingOutside) {
                        const blockedByCount = ((_c = (_b = DebugGuard.currentStates[item.hash]) === null || _b === void 0 ? void 0 : _b.wasBlockedBy) === null || _c === void 0 ? void 0 : _c.length) || 0;
                        const blockedBy = (_h = (_g = (_f = (_e = (_d = DebugGuard.currentStates[item.hash]) === null || _d === void 0 ? void 0 : _d.wasBlockedBy) === null || _e === void 0 ? void 0 : _e.filter) === null || _f === void 0 ? void 0 : _f.call(_e, (value, index, array) => array.indexOf(value) === index)) === null || _g === void 0 ? void 0 : _g.join) === null || _h === void 0 ? void 0 : _h.call(_g, ', ');
                        DebugGuard.writeFunction(LOG_PREFIX, item.key + (item.singleAccess ? ' (S)' : ' (M)'), `Waiting outside of scope. Posible blockers: `, `${blockedBy} ${blockedByCount}x`, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                            ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                            : undefined);
                    }
                }
                else {
                    DebugGuard.currentStates[item.hash].wasBlockedBy = [];
                    DebugGuard.currentStates[item.hash].enteredTime = Date.now();
                    if (DebugGuard.options.logEnterScope) {
                        DebugGuard.writeFunction(LOG_PREFIX, item.key + (item.singleAccess ? ' (S)' : ' (M)'), `Entering scope`);
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
                    if (DebugGuard.options.logContinue && waitingTime >= DebugGuard.options.logContinueMinTime) {
                        const blockedByCount = ((_b = (_a = DebugGuard.currentStates[item.hash]) === null || _a === void 0 ? void 0 : _a.wasBlockedBy) === null || _b === void 0 ? void 0 : _b.length) || 0;
                        const blockedBy = (_g = (_f = (_e = (_d = (_c = DebugGuard.currentStates[item.hash]) === null || _c === void 0 ? void 0 : _c.wasBlockedBy) === null || _d === void 0 ? void 0 : _d.filter) === null || _e === void 0 ? void 0 : _e.call(_d, (value, index, array) => array.indexOf(value) === index)) === null || _f === void 0 ? void 0 : _f.join) === null || _g === void 0 ? void 0 : _g.call(_f, ', ');
                        DebugGuard.writeFunction(LOG_PREFIX, item.key + (item.singleAccess ? ' (S)' : ' (M)'), `Continue into scope (Blocked for ${waitingTime}ms by ${blockedBy} ${blockedByCount}x)`, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
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
                if (DebugGuard.options.logLeave && lockedTime >= DebugGuard.options.logLeaveMinTime) {
                    DebugGuard.writeFunction(LOG_PREFIX, item.key + (item.singleAccess ? ' (S)' : ' (M)'), `Leaving scope (Locked for ${lockedTime}ms)`, DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
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