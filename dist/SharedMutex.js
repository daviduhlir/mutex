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
const MutexSafeCallbackHandler_1 = require("./components/MutexSafeCallbackHandler");
const SharedMutexConfigManager_1 = require("./components/SharedMutexConfigManager");
const stack_1 = require("./utils/stack");
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
    static lockSingleAccess(key, handler, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeStack = stack_1.getStackFrom('lockSingleAccess');
            return this.lockAccess(key, handler, true, maxLockingTime, codeStack);
        });
    }
    static lockMultiAccess(key, handler, maxLockingTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeStack = stack_1.getStackFrom('lockMultiAccess');
            return this.lockAccess(key, handler, false, maxLockingTime, codeStack);
        });
    }
    static lockAccess(key, handler, singleAccess, maxLockingTime, codeStack) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!codeStack) {
                codeStack = stack_1.getStackFrom('lockAccess');
            }
            const hash = utils_1.randomHash();
            const defaultMaxLockingTime = (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getConfiguration()).defaultMaxLockingTime;
            const myStackItem = {
                hash,
                key: utils_1.parseLockKey(key),
                singleAccess,
            };
            const stack = [...(SharedMutex.stackStorage.getStore() || [])];
            const nestedInRelatedItems = stack.filter(i => utils_1.keysRelatedMatch(myStackItem.key, i.key));
            let m = yield SharedMutex.lock(hash, key, {
                singleAccess,
                maxLockingTime: typeof maxLockingTime === 'number' ? maxLockingTime : defaultMaxLockingTime,
                parents: nestedInRelatedItems.map(i => i.hash),
            }, codeStack);
            const unlocker = () => {
                m === null || m === void 0 ? void 0 : m.unlock();
                m = null;
                if (handler instanceof MutexSafeCallbackHandler_1.MutexSafeCallbackHandler) {
                    handler[MutexSafeCallbackHandler_1.__mutexSafeCallbackDispose]();
                }
            };
            let fnc;
            if (handler instanceof MutexSafeCallbackHandler_1.MutexSafeCallbackHandler) {
                fnc = handler.fnc;
                handler[MutexSafeCallbackHandler_1.__mutexSafeCallbackInjector](unlocker);
            }
            else {
                fnc = handler;
            }
            let result;
            try {
                result = yield SharedMutex.stackStorage.run([...stack, myStackItem], fnc);
            }
            catch (e) {
                unlocker();
                throw e;
            }
            unlocker();
            return result;
        });
    }
    static lock(hash, key, config, codeStack) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!codeStack) {
                codeStack = stack_1.getStackFrom('lock');
            }
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
                parents: config.parents,
            }, codeStack);
            yield waiter;
            return new SharedMutexUnlockHandler(lockKey, hash);
        });
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(utils_1.parseLockKey(key), constants_1.ACTION.UNLOCK, hash);
    }
    static initialize(configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield SharedMutexConfigManager_1.SharedMutexConfigManager.initialize(configuration))) {
                return;
            }
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
            yield SharedMutexSynchronizer_1.SharedMutexSynchronizer.initializeMaster();
            if (!cluster_1.default.isWorker) {
                SharedMutex.masterVerificationWaiter.resolve();
            }
        });
    }
    static sendAction(key, action, hash, data = null, codeStack) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const message = Object.assign({ action,
                key,
                hash,
                codeStack }, data);
            if (cluster_1.default.isWorker) {
                yield SharedMutex.verifyMaster();
                (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend(message);
            }
            else {
                yield SharedMutex.masterVerificationWaiter.wait();
                if (!((_a = SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler) === null || _a === void 0 ? void 0 : _a.masterIncomingMessage)) {
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process has not initialized mutex synchronizer. usually by missing call of SharedMutex.initialize() in master process.');
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
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_DIFFERENT_VERSIONS, 'This is usually caused by more than one instance of SharedMutex package installed together.');
                }
                SharedMutex.masterVerificationWaiter.resolve();
            }
            else {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_REDUNDANT_VERIFICATION, 'This is usually caused by more than one instance of SharedMutex package installed together.');
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
            if (SharedMutex.masterVerifiedTimeout === null && !SharedMutex.masterVerificationSent) {
                SharedMutex.masterVerificationSent = true;
                (yield SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend({
                    action: constants_1.ACTION.VERIFY,
                    usingCustomConfig: yield SharedMutexConfigManager_1.SharedMutexConfigManager.getUsingDefaultConfig(),
                });
                SharedMutex.masterVerifiedTimeout = setTimeout(() => {
                    throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process does not has initialized mutex synchronizer. usually by missed call of SharedMutex.initialize() in master process.');
                }, constants_1.VERIFY_MASTER_MAX_TIMEOUT);
            }
            return SharedMutex.masterVerificationWaiter.wait();
        });
    }
}
exports.SharedMutex = SharedMutex;
SharedMutex.waitingMessagesHandlers = [];
SharedMutex.attached = false;
SharedMutex.masterVerificationWaiter = new Awaiter_1.Awaiter();
SharedMutex.masterVerifiedTimeout = null;
SharedMutex.masterVerificationSent = false;
SharedMutex.stackStorage = new AsyncLocalStorage_1.default();
