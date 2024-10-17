"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexSynchronizer = void 0;
const events_1 = require("events");
const cluster_1 = __importDefault(require("../utils/cluster"));
const utils_1 = require("../utils/utils");
const constants_1 = require("../utils/constants");
const MutexError_1 = require("../utils/MutexError");
const MutexGlobalStorage_1 = require("./MutexGlobalStorage");
const version_1 = __importDefault(require("../utils/version"));
const SharedMutexConfigManager_1 = require("./SharedMutexConfigManager");
class SharedMutexSynchronizer {
    static getLockInfo(hash) {
        const queue = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue();
        const item = queue.find(i => i.hash === hash);
        const blockedBy = queue.filter(l => l.isRunning && utils_1.keysRelatedMatch(l.key, item.key));
        if (item) {
            return {
                workerId: item.workerId,
                singleAccess: item.singleAccess,
                hash: item.hash,
                key: item.key,
                isRunning: item.isRunning,
                codeStack: item.codeStack,
                blockedBy,
            };
        }
    }
    static resetLockTimeout(hash, newMaxLockingTime) {
        const item = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash);
        if (item) {
            if (typeof newMaxLockingTime === 'number') {
                item.maxLockingTime = newMaxLockingTime;
            }
            if (item.timeout) {
                clearTimeout(item.timeout);
            }
            if (item.maxLockingTime) {
                item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(hash), item.maxLockingTime);
            }
        }
    }
    static async initializeMaster() {
        if (MutexGlobalStorage_1.MutexGlobalStorage.getInitialized() || !cluster_1.default.isMaster) {
            return;
        }
        MutexGlobalStorage_1.MutexGlobalStorage.setInitialized();
        if (cluster_1.default && typeof cluster_1.default.on === 'function') {
            ;
            (await SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).onClusterMessage(SharedMutexSynchronizer.handleClusterMessage);
            cluster_1.default.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id));
        }
        SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage;
    }
    static getLocksCount() {
        return MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().length;
    }
    static lock(item, codeStack) {
        const nItem = Object.assign(Object.assign({}, item), { codeStack });
        MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().push(nItem);
        if (nItem.maxLockingTime) {
            nItem.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(nItem.hash), nItem.maxLockingTime);
        }
        if (SharedMutexSynchronizer.reportDebugInfo) {
            SharedMutexSynchronizer.reportDebugInfo(constants_1.DEBUG_INFO_REPORTS.SCOPE_WAITING, nItem, codeStack);
        }
        SharedMutexSynchronizer.mutexTickNext();
    }
    static unlock(hash, codeStack) {
        const f = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(foundItem => foundItem.hash === hash);
        if (!f) {
            return;
        }
        if (f.timeout) {
            clearTimeout(f.timeout);
        }
        if (SharedMutexSynchronizer.reportDebugInfo) {
            SharedMutexSynchronizer.reportDebugInfo(constants_1.DEBUG_INFO_REPORTS.SCOPE_EXIT, f, codeStack);
        }
        MutexGlobalStorage_1.MutexGlobalStorage.setLocalLocksQueue(MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().filter(item => item.hash !== hash));
        SharedMutexSynchronizer.mutexTickNext();
    }
    static mutexTickNext() {
        const queue = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue();
        const changes = [];
        SharedMutexSynchronizer.solveGroup(queue, changes);
        for (const hash of changes) {
            SharedMutexSynchronizer.continue(hash);
        }
        if (changes.length) {
            SharedMutexSynchronizer.mutexTickNext();
        }
    }
    static solveGroup(queue, changes) {
        for (let i = 0; i < queue.length; i++) {
            const lock = queue[i];
            if (lock.isRunning) {
                continue;
            }
            const foundRunningLocks = queue.filter(l => l.isRunning && utils_1.keysRelatedMatch(l.key, lock.key));
            if (lock.singleAccess) {
                const isParentTreeRunning = lock.parents && foundRunningLocks.length === lock.parents.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash));
                if (foundRunningLocks.length === 0 || isParentTreeRunning) {
                    changes.push(lock.hash);
                    lock.isRunning = true;
                }
            }
            else {
                const isParentTreeRunning = lock.parents && foundRunningLocks.length === lock.parents.length && lock.parents.every(hash => foundRunningLocks.find(l => l.hash === hash));
                if (foundRunningLocks.every(lock => !lock.singleAccess) || isParentTreeRunning) {
                    changes.push(lock.hash);
                    lock.isRunning = true;
                }
            }
        }
    }
    static continue(hash, originalStack) {
        const item = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash);
        item.isRunning = true;
        const message = {
            hash: item.hash,
        };
        if (SharedMutexSynchronizer.reportDebugInfo) {
            SharedMutexSynchronizer.reportDebugInfo(constants_1.DEBUG_INFO_REPORTS.SCOPE_CONTINUE, item, originalStack);
        }
        SharedMutexSynchronizer.masterHandler.emitter.emit('message', message);
        Object.keys(cluster_1.default.workers).forEach(workerId => { var _a; return SharedMutexSynchronizer.send((_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[workerId], message); });
    }
    static handleClusterMessage(worker, message) {
        SharedMutexSynchronizer.masterIncomingMessage(message, worker);
    }
    static masterIncomingMessage(message, worker) {
        if (!message.action) {
            return;
        }
        if (message.action === constants_1.ACTION.LOCK) {
            SharedMutexSynchronizer.lock(utils_1.sanitizeLock(message), message.codeStack);
        }
        else if (message.action === constants_1.ACTION.UNLOCK) {
            SharedMutexSynchronizer.unlock(message.hash, message.codeStack);
        }
        else if (message.action === constants_1.ACTION.VERIFY) {
            if (typeof SharedMutexSynchronizer.usingCustomConfiguration === 'undefined') {
                SharedMutexSynchronizer.usingCustomConfiguration = message.usingCustomConfig;
            }
            else if (SharedMutexSynchronizer.usingCustomConfiguration !== message.usingCustomConfig) {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_CUSTOM_CONFIGURATION, 'This is usually caused by setting custom configuration by calling initialize({...}) only in some of forks, or only in master. You need to call it everywhere with same (*or compatible) config.');
            }
            SharedMutexSynchronizer.send(worker, {
                action: constants_1.ACTION.VERIFY_COMPLETE,
                version: version_1.default,
            });
        }
    }
    static workerUnlockForced(workerId) {
        MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue()
            .filter(i => i.workerId === workerId)
            .forEach(i => SharedMutexSynchronizer.unlock(i.hash));
    }
    static async send(worker, message) {
        ;
        (await SharedMutexConfigManager_1.SharedMutexConfigManager.getComm()).workerSend(worker, message);
    }
}
exports.SharedMutexSynchronizer = SharedMutexSynchronizer;
SharedMutexSynchronizer.debugWithStack = false;
SharedMutexSynchronizer.masterHandler = {
    masterIncomingMessage: null,
    emitter: new events_1.EventEmitter(),
};
SharedMutexSynchronizer.timeoutHandler = (hash) => {
    var _a, _b;
    const info = SharedMutexSynchronizer.getLockInfo(hash);
    if (!info) {
        return;
    }
    if (SharedMutexSynchronizer.reportDebugInfo) {
        SharedMutexSynchronizer.reportDebugInfo(constants_1.DEBUG_INFO_REPORTS.LOCK_TIMEOUT, MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash));
    }
    console.error(constants_1.ERROR.MUTEX_LOCK_TIMEOUT, info);
    if (info.workerId === constants_1.MASTER_ID) {
        throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_LOCK_TIMEOUT);
    }
    else {
        process.kill((_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[info.workerId]) === null || _b === void 0 ? void 0 : _b.process.pid, 9);
    }
};
//# sourceMappingURL=SharedMutexSynchronizer.js.map