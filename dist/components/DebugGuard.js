"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugGuard = void 0;
const constants_1 = require("../utils/constants");
const utils_1 = require("../utils/utils");
const LOG_PREFIX = `MUTEX_DEBUG`;
class DebugGuard {
    static reportDebugInfo(state, item) {
        if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_WAITING) {
            if (!DebugGuard.currentStates[item.hash]) {
                DebugGuard.currentStates[item.hash] = {
                    key: item.key,
                    opened: false,
                    waitingFirstTick: true,
                };
            }
            setImmediate(() => {
                var _a;
                if (!((_a = DebugGuard.currentStates[item.hash]) === null || _a === void 0 ? void 0 : _a.opened)) {
                    const allRelated = DebugGuard.getAllRelated(item.key, item.hash);
                    DebugGuard.writeFunction(LOG_PREFIX, item.key, `Waiting outside of scope. Posible blockers: `, allRelated.map(i => i.key));
                }
                else {
                    DebugGuard.writeFunction(LOG_PREFIX, item.key, `Entering scope`);
                }
                DebugGuard.currentStates[item.hash].waitingFirstTick = false;
            });
        }
        else if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_CONTINUE) {
            if (DebugGuard.currentStates[item.hash]) {
                if (!DebugGuard.currentStates[item.hash].waitingFirstTick) {
                    DebugGuard.writeFunction(LOG_PREFIX, item.key, `Continue into scope`);
                }
                DebugGuard.currentStates[item.hash].opened = true;
            }
        }
        else if (state === constants_1.DEBUG_INFO_REPORTS.SCOPE_EXIT) {
            if (DebugGuard.currentStates[item.hash]) {
                DebugGuard.writeFunction(LOG_PREFIX, item.key, `Leaving scope`);
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
DebugGuard.writeFunction = console.log;
DebugGuard.currentStates = {};
//# sourceMappingURL=DebugGuard.js.map