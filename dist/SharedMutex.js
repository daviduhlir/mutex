"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexSynchronizer = exports.SharedMutex = exports.SharedMutexDecorators = exports.SharedMutexUnlockHandler = void 0;
const events_1 = require("events");
const clutser_1 = require("./clutser");
const SecondarySynchronizer_1 = require("./SecondarySynchronizer");
class SharedMutexUtils {
    static randomHash() {
        return [...Array(10)]
            .map(x => 0)
            .map(() => Math.random().toString(36).slice(2))
            .join('');
    }
    static getAllKeys(key) {
        return key
            .split('/')
            .filter(Boolean)
            .reduce((acc, item, index, array) => {
            return [...acc, array.slice(0, index + 1).join('/')];
        }, []);
    }
    static isChildOf(key, parentKey) {
        const childKeys = SharedMutexUtils.getAllKeys(key);
        const index = childKeys.indexOf(parentKey);
        if (index !== -1 && index !== childKeys.length - 1) {
            return true;
        }
        return false;
    }
}
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
class SharedMutexDecorators {
    static lockSingleAccess(key, maxLockingTime) {
        return SharedMutexDecorators.lockAccess(key, true, maxLockingTime);
    }
    static lockMultiAccess(key, maxLockingTime) {
        return SharedMutexDecorators.lockAccess(key, false, maxLockingTime);
    }
    static lockAccess(key, singleAccess, maxLockingTime) {
        return (_target, _name, descriptor) => {
            if (typeof descriptor.value === 'function') {
                const original = descriptor.value;
                descriptor.value = function (...args) {
                    return SharedMutex.lockAccess(key, () => original(...args), singleAccess, maxLockingTime);
                };
            }
            return descriptor;
        };
    }
}
exports.SharedMutexDecorators = SharedMutexDecorators;
class SharedMutex {
    static async lockSingleAccess(key, fnc, maxLockingTime) {
        return this.lockAccess(key, fnc, true, maxLockingTime);
    }
    static async lockMultiAccess(key, fnc, maxLockingTime) {
        return this.lockAccess(key, fnc, false, maxLockingTime);
    }
    static async lockAccess(key, fnc, singleAccess, maxLockingTime) {
        const m = await SharedMutex.lock(key, singleAccess, maxLockingTime);
        let r;
        try {
            r = await fnc();
        }
        catch (e) {
            m.unlock();
            throw e;
        }
        m.unlock();
        return r;
    }
    static async lock(key, singleAccess, maxLockingTime) {
        const hash = SharedMutexUtils.randomHash();
        const eventHandler = clutser_1.default.isWorker ? process : SharedMutexSynchronizer.masterHandler.emitter;
        const waiter = new Promise((resolve) => {
            const handler = message => {
                if (message.__mutexMessage__ && message.hash === hash) {
                    eventHandler.removeListener('message', handler);
                    resolve(null);
                }
            };
            eventHandler.addListener('message', handler);
        });
        SharedMutex.sendAction(key, 'lock', hash, {
            maxLockingTime,
            singleAccess,
        });
        await waiter;
        return new SharedMutexUnlockHandler(key, hash);
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(key, 'unlock', hash);
    }
    static sendAction(key, action, hash, data = null) {
        const message = {
            __mutexMessage__: true,
            action,
            key,
            hash,
            ...data,
        };
        if (clutser_1.default.isWorker) {
            process.send({
                ...message,
                workerId: clutser_1.default.worker?.id,
            });
        }
        else {
            SharedMutexSynchronizer.masterHandler.masterIncomingMessage({
                ...message,
                workerId: 'master',
            });
        }
    }
}
exports.SharedMutex = SharedMutex;
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
        if (SharedMutexSynchronizer.alreadyInitialized || !clutser_1.default.isMaster) {
            return;
        }
        if (clutser_1.default && typeof clutser_1.default.on === 'function') {
            SharedMutexSynchronizer.reattachMessageHandlers();
            clutser_1.default?.on('fork', _ => SharedMutexSynchronizer.reattachMessageHandlers());
            clutser_1.default?.on('exit', worker => SharedMutexSynchronizer.workerUnlockForced(worker.id));
        }
        SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage;
        SharedMutexSynchronizer.alreadyInitialized = true;
    }
    static lock(item) {
        SharedMutexSynchronizer.localLocksQueue.push({ ...item });
        if (item.maxLockingTime) {
            item.timeout = setTimeout(() => SharedMutexSynchronizer.timeoutHandler(item.hash), item.maxLockingTime);
        }
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.lock(item);
        }
        if (!SharedMutexSynchronizer.secondarySynchronizer || SharedMutexSynchronizer.secondarySynchronizer?.isArbitter) {
            SharedMutexSynchronizer.mutexTickNext();
        }
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
        if (!SharedMutexSynchronizer.secondarySynchronizer || SharedMutexSynchronizer.secondarySynchronizer?.isArbitter) {
            SharedMutexSynchronizer.mutexTickNext();
        }
    }
    static mutexTickNext() {
        const allKeys = SharedMutexSynchronizer.localLocksQueue.reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind);
        }, []);
        for (const key of allKeys) {
            const queue = SharedMutexSynchronizer.localLocksQueue.filter(i => i.key === key);
            const runnings = queue.filter(i => i.isRunning);
            const allSubKeys = SharedMutexUtils.getAllKeys(key);
            const posibleBlockingItems = SharedMutexSynchronizer.localLocksQueue.filter(i => (i.isRunning && allSubKeys.includes(i.key)) || SharedMutexUtils.isChildOf(i.key, key));
            if (queue?.length) {
                if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItems.length) {
                    SharedMutexSynchronizer.continue(queue[0]);
                }
                else if (runnings.every(i => !i.singleAccess) && posibleBlockingItems.every(i => !i?.singleAccess)) {
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
        Object.keys(clutser_1.default.workers).forEach(workerId => clutser_1.default.workers?.[workerId]?.send(message));
        if (SharedMutexSynchronizer.secondarySynchronizer) {
            SharedMutexSynchronizer.secondarySynchronizer.continue(item);
        }
    }
    static masterIncomingMessage(message) {
        if (!message.__mutexMessage__ || !message.action) {
            return;
        }
        if (message.action === 'lock') {
            SharedMutexSynchronizer.lock(message);
        }
        else if (message.action === 'unlock') {
            SharedMutexSynchronizer.unlock(message.hash);
        }
    }
    static reattachMessageHandlers() {
        Object.keys(clutser_1.default.workers).forEach(workerId => {
            clutser_1.default.workers?.[workerId]?.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage);
            clutser_1.default.workers?.[workerId]?.addListener('message', SharedMutexSynchronizer.masterIncomingMessage);
        });
    }
    static workerUnlockForced(workerId) {
        clutser_1.default.workers?.[workerId]?.removeListener('message', SharedMutexSynchronizer.masterIncomingMessage);
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
    const info = SharedMutexSynchronizer.getLockInfo(hash);
    console.error('MUTEX_LOCK_TIMEOUT', info);
    if (info.workerId === 'master') {
        throw new Error('MUTEX_LOCK_TIMEOUT');
    }
    else {
        process.kill(clutser_1.default.workers?.[info.workerId]?.process.pid, 9);
    }
};
//# sourceMappingURL=SharedMutex.js.map