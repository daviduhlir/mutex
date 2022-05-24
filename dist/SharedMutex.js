"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutex = exports.SharedMutexDecorators = exports.SharedMutexUnlockHandler = void 0;
const events_1 = require("events");
let cluster = {
    isMaster: true,
    isWorker: false,
    worker: null,
    workers: null,
    on: null,
};
try {
    cluster = require('cluster');
}
catch (e) { }
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
    static lockSingleAccessDecorator(key, maxLockingTime) {
        return SharedMutexDecorators.lockAccessDecorator(key, true, maxLockingTime);
    }
    static lockMultiAccessDecorator(key, maxLockingTime) {
        return SharedMutexDecorators.lockAccessDecorator(key, false, maxLockingTime);
    }
    static lockAccessDecorator(key, singleAccess, maxLockingTime) {
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
        const eventHandler = cluster.isWorker ? process : SharedMutexSynchronizer.masterHandler.emitter;
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
        if (cluster.isWorker) {
            process.send({
                ...message,
                workerId: cluster.worker?.id,
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
    static initializeMaster() {
        if (cluster && typeof cluster.on === 'function') {
            Object.keys(cluster.workers).forEach(workerId => {
                cluster.workers[workerId].on('message', SharedMutexSynchronizer.masterIncomingMessage);
            });
            cluster.on('fork', worker => {
                worker.on('message', SharedMutexSynchronizer.masterIncomingMessage);
            });
            cluster.on('exit', worker => {
                SharedMutexSynchronizer.workerUnlockForced(worker.id);
            });
        }
        SharedMutexSynchronizer.masterHandler.masterIncomingMessage = SharedMutexSynchronizer.masterIncomingMessage;
    }
    static lock(key, workerId, singleAccess, hash, maxLockingTime) {
        const item = {
            workerId,
            singleAccess,
            hash,
            key,
        };
        SharedMutexSynchronizer.localLocksQueue.push(item);
        if (maxLockingTime) {
            item.timeout = setTimeout(() => SharedMutexSynchronizer.unlock(hash), maxLockingTime);
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
        SharedMutexSynchronizer.mutexTickNext();
    }
    static mutexTickNext() {
        const allKeys = SharedMutexSynchronizer.localLocksQueue.reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind);
        }, []);
        for (const key of allKeys) {
            const queue = SharedMutexSynchronizer.localLocksQueue.filter(i => i.key === key);
            const runnings = queue.filter(i => i.isRunning);
            const allKeys = SharedMutexUtils.getAllKeys(key);
            const posibleBlockingItem = SharedMutexSynchronizer.localLocksQueue.find(i => (i.isRunning && allKeys.includes(i.key)) || SharedMutexUtils.isChildOf(i.key, key));
            if (queue?.length) {
                if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItem) {
                    SharedMutexSynchronizer.mutexContinue(queue[0]);
                }
                else if (runnings.every(i => !i.singleAccess) && !posibleBlockingItem?.singleAccess) {
                    for (const item of queue) {
                        if (item.singleAccess) {
                            break;
                        }
                        SharedMutexSynchronizer.mutexContinue(item);
                    }
                }
            }
        }
    }
    static mutexContinue(workerIitem) {
        workerIitem.isRunning = true;
        const message = {
            __mutexMessage__: true,
            hash: workerIitem.hash,
        };
        if (workerIitem.workerId === 'master') {
            SharedMutexSynchronizer.masterHandler.emitter.emit('message', message);
        }
        else {
            cluster.workers[workerIitem.workerId].send(message);
        }
    }
    static masterIncomingMessage(message) {
        if (!message.__mutexMessage__ || !message.action) {
            return;
        }
        if (message.action === 'lock') {
            SharedMutexSynchronizer.lock(message.key, message.workerId, message.singleAccess, message.hash, message.maxLockingTime);
        }
        else if (message.action === 'unlock') {
            SharedMutexSynchronizer.unlock(message.hash);
        }
    }
    static workerUnlockForced(workerId) {
        SharedMutexSynchronizer.localLocksQueue.filter(i => i.workerId === workerId).forEach(i => SharedMutexSynchronizer.unlock(i.hash));
    }
}
SharedMutexSynchronizer.localLocksQueue = [];
SharedMutexSynchronizer.masterHandler = {
    masterIncomingMessage: null,
    emitter: new events_1.EventEmitter(),
};
if (cluster.isMaster) {
    SharedMutexSynchronizer.initializeMaster();
}
//# sourceMappingURL=SharedMutex.js.map