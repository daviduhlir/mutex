"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexSynchronizer = void 0;
const events_1 = require("events");
const cluster_1 = __importDefault(require("./utils/cluster"));
const SecondarySynchronizer_1 = require("./SecondarySynchronizer");
const utils_1 = require("./utils/utils");
class SharedMutexSynchronizer {
    static setSecondarySynchronizer(secondarySynchronizer) {
        SharedMutexSynchronizer.secondarySynchronizer = secondarySynchronizer;
        SharedMutexSynchronizer.secondarySynchronizer.on(SecondarySynchronizer_1.SYNC_EVENTS.LOCK, SharedMutexSynchronizer.lock);
        SharedMutexSynchronizer.secondarySynchronizer.on(SecondarySynchronizer_1.SYNC_EVENTS.UNLOCK, SharedMutexSynchronizer.unlock);
        SharedMutexSynchronizer.secondarySynchronizer.on(SecondarySynchronizer_1.SYNC_EVENTS.CONTINUE, SharedMutexSynchronizer.continue);
    }
    static getLockInfo(hash) {
        const item = this.localLocksQueue.find(i => i.hash === hash);
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
        const item = this.localLocksQueue.find(i => i.hash === hash);
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
        if (SharedMutexSynchronizer.alreadyInitialized || !cluster_1.default.isPrimary) {
            return;
        }
        if (cluster_1.default && typeof cluster_1.default.on === 'function') {
            SharedMutexSynchronizer.reattachMessageHandlers();
            cluster_1.default === null || cluster_1.default === void 0 ? void 0 : cluster_1.default.on('fork', () => SharedMutexSynchronizer.reattachMessageHandlers());
            cluster_1.default === null || cluster_1.default === void 0 ? void 0 : cluster_1.default.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id));
        }
        SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage;
        SharedMutexSynchronizer.alreadyInitialized = true;
    }
    static lock(item) {
        SharedMutexSynchronizer.localLocksQueue.push(Object.assign({}, item));
        if (item.maxLockingTime) {
            item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(item.hash), item.maxLockingTime);
        }
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.lock(item);
        }
        SharedMutexSynchronizer.mutexTickNext();
    }
    static unlock(hash) {
        const f = SharedMutexSynchronizer.localLocksQueue.find(foundItem => foundItem.hash === hash);
        if (!f) {
            return;
        }
        if (f.timeout) {
            clearTimeout(f.timeout);
        }
        SharedMutexSynchronizer.localLocksQueue = SharedMutexSynchronizer.localLocksQueue.filter(item => item.hash !== hash);
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
        const allKeys = SharedMutexSynchronizer.localLocksQueue.reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind);
        }, []);
        for (const key of allKeys) {
            const queue = SharedMutexSynchronizer.localLocksQueue.filter(i => i.key === key);
            if (queue === null || queue === void 0 ? void 0 : queue.length) {
                const runnings = queue.filter(i => i.isRunning);
                const posibleBlockingItems = SharedMutexSynchronizer.localLocksQueue.filter(i => i.isRunning && utils_1.keysRelatedMatch(key, i.key) && key !== i.key);
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
        SharedMutexSynchronizer.masterHandler.emitter.emit('message', message);
        Object.keys(cluster_1.default.workers).forEach(workerId => {
            var _a, _b;
            (_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[workerId]) === null || _b === void 0 ? void 0 : _b.send(message, err => {
                if (err) {
                }
            });
        });
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.continue(item);
        }
    }
    static masterIncomingMessage(message) {
        if (!message.__mutexMessage__ || !message.action) {
            return;
        }
        if (message.action === 'lock') {
            SharedMutexSynchronizer.lock(utils_1.sanitizeLock(message));
        }
        else if (message.action === 'unlock') {
            SharedMutexSynchronizer.unlock(message.hash);
        }
    }
    static reattachMessageHandlers() {
        Object.keys(cluster_1.default.workers).forEach(workerId => {
            var _a, _b, _c, _d;
            (_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[workerId]) === null || _b === void 0 ? void 0 : _b.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage);
            (_d = (_c = cluster_1.default.workers) === null || _c === void 0 ? void 0 : _c[workerId]) === null || _d === void 0 ? void 0 : _d.addListener('message', SharedMutexSynchronizer.masterIncomingMessage);
        });
    }
    static workerUnlockForced(workerId) {
        var _a, _b;
        (_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[workerId]) === null || _b === void 0 ? void 0 : _b.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage);
        SharedMutexSynchronizer.localLocksQueue.filter(i => i.workerId === workerId).forEach(i => SharedMutexSynchronizer.unlock(i.hash));
    }
}
exports.SharedMutexSynchronizer = SharedMutexSynchronizer;
SharedMutexSynchronizer.localLocksQueue = [];
SharedMutexSynchronizer.alreadyInitialized = false;
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
    console.error('MUTEX_LOCK_TIMEOUT', info);
    if (info.workerId === 'master') {
        throw new Error('MUTEX_LOCK_TIMEOUT');
    }
    else {
        process.kill((_b = (_a = cluster_1.default.workers) === null || _a === void 0 ? void 0 : _a[info.workerId]) === null || _b === void 0 ? void 0 : _b.process.pid, 9);
    }
};
//# sourceMappingURL=SharedMutexSynchronizer.js.map