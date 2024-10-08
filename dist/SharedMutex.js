"use strict";
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
    static async lockSingleAccess(key, handler, maxLockingTime) {
        const codeStack = stack_1.getStackFrom('lockSingleAccess');
        return this.lockAccess(key, handler, true, maxLockingTime, codeStack);
    }
    static async lockMultiAccess(key, handler, maxLockingTime) {
        const codeStack = stack_1.getStackFrom('lockMultiAccess');
        return this.lockAccess(key, handler, false, maxLockingTime, codeStack);
    }
    static async lockAccess(key, handler, singleAccess, maxLockingTime, codeStack) {
        if (!codeStack) {
            codeStack = stack_1.getStackFrom('lockAccess');
        }
        const hash = utils_1.randomHash();
        const stack = [...(SharedMutex.stackStorage.getStore() || [])];
        const myStackItem = {
            hash,
            key: utils_1.parseLockKey(key),
            singleAccess,
        };
        const nestedInRelatedItems = stack.filter(i => utils_1.keysRelatedMatch(myStackItem.key, i.key));
        const defaultMaxLockingTime = (await SharedMutexConfigManager_1.SharedMutexConfigManager.getConfiguration()).defaultMaxLockingTime;
        let m = await SharedMutex.lock(hash, key, {
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
            result = await SharedMutex.stackStorage.run([...stack, myStackItem], fnc);
        }
        catch (e) {
            unlocker();
            throw e;
        }
        unlocker();
        return result;
    }
    static async lock(hash, key, config, codeStack) {
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
        await SharedMutex.sendAction(lockKey, constants_1.ACTION.LOCK, hash, {
            maxLockingTime: config.maxLockingTime,
            singleAccess: config.singleAccess,
            parents: config.parents,
        }, codeStack);
        await waiter;
        return new SharedMutexUnlockHandler(lockKey, hash);
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(utils_1.parseLockKey(key), constants_1.ACTION.UNLOCK, hash);
    }
    static async initialize(configuration) {
        if (!(await SharedMutexConfigManager_1.SharedMutexConfigManager.initialize(configuration))) {
            return;
        }
        if (!SharedMutex.attached) {
            SharedMutex.attached = true;
            if (cluster_1.default.isWorker) {
                ;
                (await SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).onProcessMessage(SharedMutex.handleMessage);
            }
            else {
                SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.emitter.on('message', SharedMutex.handleMessage);
            }
        }
        await SharedMutexSynchronizer_1.SharedMutexSynchronizer.initializeMaster();
        if (!cluster_1.default.isWorker) {
            SharedMutex.masterVerificationWaiter.resolve();
        }
    }
    static async sendAction(key, action, hash, data = null, codeStack) {
        var _a;
        const message = Object.assign({ action,
            key,
            hash,
            codeStack }, data);
        if (cluster_1.default.isWorker) {
            await SharedMutex.verifyMaster();
            (await SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend(message);
        }
        else {
            await SharedMutex.masterVerificationWaiter.wait();
            if (!((_a = SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler) === null || _a === void 0 ? void 0 : _a.masterIncomingMessage)) {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process has not initialized mutex synchronizer. usually by missing call of SharedMutex.initialize() in master process.');
            }
            SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.masterIncomingMessage(Object.assign(Object.assign({}, message), { workerId: constants_1.MASTER_ID }));
        }
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
    static async verifyMaster() {
        if (SharedMutex.masterVerificationWaiter.resolved) {
            return;
        }
        if (SharedMutex.masterVerifiedTimeout === null && !SharedMutex.masterVerificationSent) {
            SharedMutex.masterVerificationSent = true;
            (await SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).processSend({
                action: constants_1.ACTION.VERIFY,
                usingCustomConfig: await SharedMutexConfigManager_1.SharedMutexConfigManager.getUsingDefaultConfig(),
            });
            SharedMutex.masterVerifiedTimeout = setTimeout(() => {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_MASTER_NOT_INITIALIZED, 'Master process does not has initialized mutex synchronizer. usually by missed call of SharedMutex.initialize() in master process.');
            }, constants_1.VERIFY_MASTER_MAX_TIMEOUT);
        }
        return SharedMutex.masterVerificationWaiter.wait();
    }
}
exports.SharedMutex = SharedMutex;
SharedMutex.waitingMessagesHandlers = [];
SharedMutex.attached = false;
SharedMutex.masterVerificationWaiter = new Awaiter_1.Awaiter();
SharedMutex.masterVerifiedTimeout = null;
SharedMutex.masterVerificationSent = false;
SharedMutex.stackStorage = new AsyncLocalStorage_1.default();
//# sourceMappingURL=SharedMutex.js.map