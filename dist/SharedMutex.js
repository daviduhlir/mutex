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
const SharedMutexSynchronizer_1 = require("./components/SharedMutexSynchronizer");
const AsyncLocalStorage_1 = __importDefault(require("./components/AsyncLocalStorage"));
const constants_1 = require("./utils/constants");
const MutexError_1 = require("./utils/MutexError");
const Awaiter_1 = require("./utils/Awaiter");
const version_1 = __importDefault(require("./utils/version"));
const SharedMutexConfigManager_1 = require("./components/SharedMutexConfigManager");
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
            const strictMode = (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getConfiguration()).strictMode;
            if (nestedInRelatedItems.length && strictMode) {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_NESTED_SCOPES, `ERROR Found nested locks with same key (${myStackItem.key}), which will cause death end of your application, because one of stacked lock is marked as single access only.`);
            }
            const shouldSkipLock = nestedInRelatedItems.length && !strictMode;
            const m = yield SharedMutex.lock(key, {
                singleAccess,
                maxLockingTime: maxLockingTime === undefined ? (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getConfiguration()).defaultMaxLockingTime : maxLockingTime,
                strictMode,
                forceInstantContinue: shouldSkipLock,
            });
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
                        if (message.hash === hash) {
                            SharedMutex.waitingMessagesHandlers = SharedMutex.waitingMessagesHandlers.filter(i => i.hash !== hash);
                            resolve(null);
                        }
                    },
                });
            });
            const lockKey = utils_1.parseLockKey(key);
            yield SharedMutex.sendAction(lockKey, constants_1.ACTION.LOCK, hash, {
                maxLockingTime: config.maxLockingTime,
                singleAccess: config.singleAccess,
                forceInstantContinue: config.forceInstantContinue,
            });
            yield waiter;
            return new SharedMutexUnlockHandler(lockKey, hash);
        });
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(utils_1.parseLockKey(key), constants_1.ACTION.UNLOCK, hash);
    }
    static attachHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!SharedMutex.attached) {
                SharedMutex.attached = true;
                if (cluster_1.default.isWorker) {
                    ;
                    (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).onProcessMessage(SharedMutex.handleMessage);
                }
                else {
                    SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.emitter.on('message', SharedMutex.handleMessage);
                }
            }
        });
    }
    static initialize(configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield SharedMutexConfigManager_1.SharedMutexConfigManager.initialize(configuration))) {
                return;
            }
            yield SharedMutex.attachHandler();
            yield SharedMutexSynchronizer_1.SharedMutexSynchronizer.initializeMaster();
        });
    }
    static sendAction(key, action, hash, data = null) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const message = Object.assign({ action,
                key,
                hash }, data);
            if (cluster_1.default.isWorker) {
                yield SharedMutex.verifyMaster();
                (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend(message);
            }
            else {
                if (!((_a = SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler) === null || _a === void 0 ? void 0 : _a.masterIncomingMessage)) {
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process does not has initialized mutex synchronizer. Usualy by missed call of SharedMutex.initialize() in master process.');
                }
                SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.masterIncomingMessage(Object.assign(Object.assign({}, message), { workerId: constants_1.MASTER_ID }));
            }
        });
    }
    static handleMessage(message) {
        if (message.action === constants_1.ACTION.VERIFY_COMPLETE) {
            if (SharedMutex.masterVerifiedTimeout) {
                clearTimeout(SharedMutex.masterVerifiedTimeout);
                SharedMutex.masterVerifiedTimeout = null;
                if (message.version !== version_1.default) {
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_DIFFERENT_VERSIONS, 'This is usualy caused by more than one instance of SharedMutex installed together in different version. Version of mutexes must be completly same.');
                }
                SharedMutex.masterVerificationWaiter.resolve();
            }
            else {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_REDUNDANT_VERIFICATION, 'This is usualy caused by more than one instance of SharedMutex installed together.');
            }
        }
        else if (message.hash) {
            const foundItem = SharedMutex.waitingMessagesHandlers.find(item => item.hash === message.hash);
            if (foundItem) {
                foundItem.resolve(message);
            }
        }
    }
    static verifyMaster() {
        return __awaiter(this, void 0, void 0, function* () {
            if (SharedMutex.masterVerificationWaiter.resolved) {
                return;
            }
            if (SharedMutex.masterVerifiedTimeout === null) {
                ;
                (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend({
                    action: constants_1.ACTION.VERIFY,
                    usingCustomConfig: yield SharedMutexConfigManager_1.SharedMutexConfigManager.getUsingDefaultConfig(),
                });
                SharedMutex.masterVerifiedTimeout = setTimeout(() => {
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process does not has initialized mutex synchronizer. Usualy by missed call of SharedMutex.initialize() in master process.');
                }, constants_1.VERIFY_MASTER_MAX_TIMEOUT);
            }
            yield SharedMutex.masterVerificationWaiter.wait();
        });
    }
}
exports.SharedMutex = SharedMutex;
SharedMutex.waitingMessagesHandlers = [];
SharedMutex.attached = false;
SharedMutex.masterVerificationWaiter = new Awaiter_1.Awaiter();
SharedMutex.masterVerifiedTimeout = null;
SharedMutex.stackStorage = new AsyncLocalStorage_1.default();
//# sourceMappingURL=SharedMutex.js.map