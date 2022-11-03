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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutex = exports.SharedMutexUnlockHandler = void 0;
const cluster_1 = __importDefault(require("./utils/cluster"));
const utils_1 = require("./utils/utils");
const SharedMutexSynchronizer_1 = require("./SharedMutexSynchronizer");
const async_hooks_1 = require("async_hooks");
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
            const stack = [...(SharedMutex.stackStorage.getStore() || [])];
            const myStackItem = {
                key: utils_1.parseLockKey(key),
                singleAccess,
            };
            const nestedInRelatedItems = stack.filter(i => utils_1.keysRelatedMatch(i.key, myStackItem.key));
            if (nestedInRelatedItems.length && SharedMutex.strictMode) {
                throw new Error(`ERROR Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`);
            }
            const shouldSkipLock = nestedInRelatedItems.length && !SharedMutex.strictMode;
            const m = !shouldSkipLock ? yield SharedMutex.lock(key, { singleAccess, maxLockingTime, strictMode: SharedMutex.strictMode }) : null;
            let result;
            try {
                result = yield SharedMutex.stackStorage.run([...stack, myStackItem], fnc);
            }
            catch (e) {
                m.unlock();
                throw e;
            }
            m === null || m === void 0 ? void 0 : m.unlock();
            return result;
        });
    }
    static lock(key, config) {
        return __awaiter(this, void 0, void 0, function* () {
            const hash = utils_1.randomHash();
            const waiter = new Promise((resolve) => {
                SharedMutex.waitingMessagesHandlers.push({
                    hash,
                    resolve: message => {
                        if (message.__mutexMessage__ && message.hash === hash) {
                            SharedMutex.waitingMessagesHandlers = SharedMutex.waitingMessagesHandlers.filter(i => i.hash !== hash);
                            resolve(null);
                        }
                    },
                });
            });
            const lockKey = utils_1.parseLockKey(key);
            SharedMutex.sendAction(lockKey, 'lock', hash, {
                maxLockingTime: config.maxLockingTime,
                singleAccess: config.singleAccess,
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
        if (cluster_1.default.isWorker) {
            process.send(Object.assign(Object.assign({}, message), { workerId: (_a = cluster_1.default.worker) === null || _a === void 0 ? void 0 : _a.id }));
        }
        else {
            SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.masterIncomingMessage(Object.assign(Object.assign({}, message), { workerId: 'master' }));
        }
    }
    static attachHandler() {
        if (!SharedMutex.attached) {
            SharedMutex.attached = true;
            const eventHandler = cluster_1.default.isWorker ? process : SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.emitter;
            eventHandler.addListener('message', SharedMutex.handleMessage);
        }
    }
    static handleMessage(message) {
        if (message.__mutexMessage__ && message.hash) {
            const foundItem = SharedMutex.waitingMessagesHandlers.find(item => item.hash === message.hash);
            if (foundItem) {
                foundItem.resolve(message);
            }
        }
    }
}
exports.SharedMutex = SharedMutex;
SharedMutex.strictMode = false;
SharedMutex.waitingMessagesHandlers = [];
SharedMutex.attached = false;
SharedMutex.stackStorage = new async_hooks_1.AsyncLocalStorage();
SharedMutex.attachHandler();
//# sourceMappingURL=SharedMutex.js.map