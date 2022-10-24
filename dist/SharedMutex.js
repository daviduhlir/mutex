"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutex = exports.SharedMutexUnlockHandler = void 0;
const clutser_1 = require("./utils/clutser");
const utils_1 = require("./utils/utils");
const SharedMutexSynchronizer_1 = require("./SharedMutexSynchronizer");
class SharedMutexUnlockHandler {
    constructor(key, hash) {
        this.key = key;
        this.hash = hash;
    }
    unlock() {
        SharedMutex.unlock(this.key, this.hash);
    }
}
exports.SharedMutexUnlockHandler = SharedMutexUnlockHandler;
class SharedMutex {
    static lockSingleAccess(key, fnc, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.lockAccess(key, fnc, true, maxLockingTime);
        });
    }
    static lockMultiAccess(key, fnc, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.lockAccess(key, fnc, false, maxLockingTime);
        });
    }
    static lockAccess(key, fnc, singleAccess, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const stack = [...SharedMutex.stack];
            const myStackItem = {
                key: utils_1.parseLockKey(key),
                singleAccess,
            };
            const nestedOfItem = stack.filter(i => i.key === myStackItem.key);
            if (nestedOfItem.length && [...nestedOfItem.map(i => i.singleAccess), singleAccess].some(i => !!i)) {
                SharedMutex.warning(`MUTEX ERROR: Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`);
            }
            const m = yield SharedMutex.lock(key, singleAccess, maxLockingTime);
            let r;
            try {
                SharedMutex.stack = [...stack, myStackItem];
                r = yield fnc();
                SharedMutex.stack = stack;
            }
            catch (e) {
                m.unlock();
                throw e;
            }
            m.unlock();
            return r;
        });
    }
    static lock(key, singleAccess, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const hash = utils_1.randomHash();
            const eventHandler = clutser_1.default.isWorker ? process : SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.emitter;
            const waiter = new Promise((resolve) => {
                const handler = message => {
                    if (message.__mutexMessage__ && message.hash === hash) {
                        eventHandler.removeListener('message', handler);
                        resolve(null);
                    }
                };
                eventHandler.addListener('message', handler);
            });
            const lockKey = utils_1.parseLockKey(key);
            SharedMutex.sendAction(lockKey, 'lock', hash, {
                maxLockingTime,
                singleAccess,
            });
            yield waiter;
            return new SharedMutexUnlockHandler(lockKey, hash);
        });
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(utils_1.parseLockKey(key), 'unlock', hash);
    }
    static sendAction(key, action, hash, data = null) {
        var _a;
        const message = Object.assign({ __mutexMessage__: true, action,
            key,
            hash }, data);
        if (clutser_1.default.isWorker) {
            process.send(Object.assign(Object.assign({}, message), { workerId: (_a = clutser_1.default.worker) === null || _a === void 0 ? void 0 : _a.id }));
        }
        else {
            SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.masterIncomingMessage(Object.assign(Object.assign({}, message), { workerId: 'master' }));
        }
    }
    static warning(message) {
        if (SharedMutex.warningThrowsError) {
            throw new Error(`MUTEX: ${message}`);
        }
        else {
            console.warn(`MUTEX: ${message}`);
        }
    }
}
exports.SharedMutex = SharedMutex;
SharedMutex.warningThrowsError = false;
SharedMutex.stack = [];
//# sourceMappingURL=SharedMutex.js.map