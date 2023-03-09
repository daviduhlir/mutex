"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexSynchronizer = exports.DEBUG_INFO_REPORTS = void 0;
const events_1 = require("events");
const cluster_1 = __importDefault(require("./utils/cluster"));
const utils_1 = require("./utils/utils");
const constants_1 = require("./utils/constants");
const MutexError_1 = require("./utils/MutexError");
const MutexGlobalStorage_1 = require("./utils/MutexGlobalStorage");
exports.DEBUG_INFO_REPORTS = {
    LOCK_TIMEOUT: 'LOCK_TIMEOUT',
    SCOPE_WAITING: 'SCOPE_WAITING',
    SCOPE_EXIT: 'SCOPE_EXIT',
    SCOPE_CONTINUE: 'SCOPE_CONTINUE',
};
class SharedMutexSynchronizer {
    static setSecondarySynchronizer(secondarySynchronizer) {
        SharedMutexSynchronizer.secondarySynchronizer = secondarySynchronizer;
        SharedMutexSynchronizer.secondarySynchronizer.on(constants_1.SYNC_EVENTS.LOCK, SharedMutexSynchronizer.lock);
        SharedMutexSynchronizer.secondarySynchronizer.on(constants_1.SYNC_EVENTS.UNLOCK, SharedMutexSynchronizer.unlock);
        SharedMutexSynchronizer.secondarySynchronizer.on(constants_1.SYNC_EVENTS.CONTINUE, SharedMutexSynchronizer.continue);
    }
    static getLockInfo(hash) {
        const item = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash);
        if (item) {
            return {
                workerId: item.workerId,
                singleAccess: item.singleAccess,
                hash: item.hash,
                key: item.key,
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
    static initializeMaster() {
        if (MutexGlobalStorage_1.MutexGlobalStorage.getInitialized() || !cluster_1.default.isMaster) {
            return;
        }
        if (cluster_1.default && typeof cluster_1.default.on === 'function') {
            cluster_1.default.on('message', SharedMutexSynchronizer.handleClusterMessage);
            cluster_1.default.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id));
        }
        SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage;
        MutexGlobalStorage_1.MutexGlobalStorage.setInitialized();
    }
    static lock(item) {
        const nItem = Object.assign({}, item);
        MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().push(nItem);
        if (nItem.maxLockingTime) {
            nItem.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(nItem.hash), nItem.maxLockingTime === undefined ? SharedMutexSynchronizer.defaultMaxLockingTime : nItem.maxLockingTime);
        }
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.lock(nItem);
        }
        SharedMutexSynchronizer.reportDebugInfo(exports.DEBUG_INFO_REPORTS.SCOPE_WAITING, nItem);
        SharedMutexSynchronizer.mutexTickNext();
    }
    static unlock(hash) {
        const f = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(foundItem => foundItem.hash === hash);
        if (!f) {
            return;
        }
        if (f.timeout) {
            clearTimeout(f.timeout);
        }
        SharedMutexSynchronizer.reportDebugInfo(exports.DEBUG_INFO_REPORTS.SCOPE_EXIT, f);
        MutexGlobalStorage_1.MutexGlobalStorage.setLocalLocksQueue(MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().filter(item => item.hash !== hash));
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.unlock(hash);
        }
        SharedMutexSynchronizer.mutexTickNext();
    }
    static mutexTickNext() {
        var _a;
        if (SharedMutexSynchronizer.secondarySynchronizer && !((_a = SharedMutexSynchronizer.secondarySynchronizer) === null || _a === void 0 ? void 0 : _a.isArbitter)) {
            return;
        }
        const topItem = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue()[MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().length - 1];
        if (topItem === null || topItem === void 0 ? void 0 : topItem.forceInstantContinue) {
            SharedMutexSynchronizer.continue(topItem);
        }
        const allKeys = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind);
        }, []);
        for (const key of allKeys) {
            const queue = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().filter(i => i.key === key);
            if (queue === null || queue === void 0 ? void 0 : queue.length) {
                const runnings = queue.filter(i => i.isRunning);
                const posibleBlockingItems = MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().filter(i => i.isRunning && utils_1.keysRelatedMatch(key, i.key) && key !== i.key);
                if (queue[0].singleAccess && !(runnings === null || runnings === void 0 ? void 0 : runnings.length) && !posibleBlockingItems.length) {
                    SharedMutexSynchronizer.continue(queue[0]);
                }
                else if (runnings.every(i => !i.singleAccess) && posibleBlockingItems.every(i => !(i === null || i === void 0 ? void 0 : i.singleAccess))) {
                    for (const item of queue) {
                        if (item.singleAccess) {
                            break;
                        }
                        SharedMutexSynchronizer.continue(item);
                    }
                }
            }
        }
    }
    static continue(item) {
        item.isRunning = true;
        const message = {
            __mutexMessage__: true,
            hash: item.hash,
        };
        SharedMutexSynchronizer.reportDebugInfo(exports.DEBUG_INFO_REPORTS.SCOPE_CONTINUE, item);
        SharedMutexSynchronizer.masterHandler.emitter.emit('message', message);
        Object.keys(cluster_1.default.workers).forEach(workerId => { var _a; return SharedMutexSynchronizer.send((_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[workerId], message); });
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.continue(item);
        }
    }
    static handleClusterMessage(worker, message) {
        SharedMutexSynchronizer.masterIncomingMessage(message, worker);
    }
    static masterIncomingMessage(message, worker) {
        if (!message.__mutexMessage__ || !message.action) {
            return;
        }
        if (message.action === constants_1.ACTION.LOCK) {
            SharedMutexSynchronizer.lock(utils_1.sanitizeLock(message));
        }
        else if (message.action === constants_1.ACTION.UNLOCK) {
            SharedMutexSynchronizer.unlock(message.hash);
        }
        else if (message.action === constants_1.ACTION.VERIFY) {
            SharedMutexSynchronizer.send(worker, {
                action: constants_1.ACTION.VERIFY_COMPLETE,
            });
        }
    }
    static workerUnlockForced(workerId) {
        MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue()
            .filter(i => i.workerId === workerId)
            .forEach(i => SharedMutexSynchronizer.unlock(i.hash));
    }
    static send(worker, message) {
        worker.send(Object.assign({ __mutexMessage__: true }, message), err => {
            if (err) {
            }
        });
    }
}
exports.SharedMutexSynchronizer = SharedMutexSynchronizer;
SharedMutexSynchronizer.reportDebugInfo = (state, item) => { };
SharedMutexSynchronizer.secondarySynchronizer = null;
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
    SharedMutexSynchronizer.reportDebugInfo(exports.DEBUG_INFO_REPORTS.LOCK_TIMEOUT, MutexGlobalStorage_1.MutexGlobalStorage.getLocalLocksQueue().find(i => i.hash === hash));
    console.error(constants_1.ERROR.MUTEX_LOCK_TIMEOUT, info);
    if (info.workerId === constants_1.MASTER_ID) {
        throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_LOCK_TIMEOUT);
    }
    else {
        process.kill((_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[info.workerId]) === null || _b === void 0 ? void 0 : _b.process.pid, 9);
    }
};
SharedMutexSynchronizer.defaultMaxLockingTime = undefined;
//# sourceMappingURL=SharedMutexSynchronizer.js.map