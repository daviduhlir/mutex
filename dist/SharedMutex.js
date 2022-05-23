"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutex = exports.SharedMutexUnlockHandler = void 0;
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
        return [...Array(10)].map(x => 0).map(() => Math.random().toString(36).slice(2)).join('');
    }
    static getAllKeys(key) {
        return key.split('/').filter(Boolean).reduce((acc, item, index, array) => {
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
const MasterHandler = {
    masterIncomingMessage: null,
    emitter: new events_1.EventEmitter(),
};
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
    static async lockSingleAccess(key, fnc, maxLockingTime) {
        const m = await SharedMutex.lock(key, true, maxLockingTime);
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
    static async lockMultiAccess(key, fnc, maxLockingTime) {
        const m = await SharedMutex.lock(key, false, maxLockingTime);
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
        const eventHandler = cluster.isWorker ? process : MasterHandler.emitter;
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
            MasterHandler.masterIncomingMessage({
                ...message,
                workerId: 'master',
            });
        }
    }
}
exports.SharedMutex = SharedMutex;
if (cluster.isMaster) {
    let localLocksQueue = [];
    function mutexTickNext() {
        const allKeys = localLocksQueue.reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind);
        }, []);
        for (const key of allKeys) {
            const queue = localLocksQueue.filter(i => i.key === key);
            const runnings = queue.filter(i => i.isRunning);
            const allKeys = SharedMutexUtils.getAllKeys(key);
            const posibleBlockingItem = localLocksQueue.find(i => i.isRunning && allKeys.includes(i.key) || SharedMutexUtils.isChildOf(i.key, key));
            if (queue?.length) {
                if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItem) {
                    mutexContinue(queue[0]);
                }
                else if (runnings.every(i => !i.singleAccess) && !posibleBlockingItem?.singleAccess) {
                    for (const item of queue) {
                        if (item.singleAccess) {
                            break;
                        }
                        mutexContinue(item);
                    }
                }
            }
        }
    }
    function lock(key, workerId, singleAccess, hash, maxLockingTime) {
        const item = {
            workerId,
            singleAccess,
            hash,
            key,
        };
        localLocksQueue.push(item);
        if (maxLockingTime) {
            item.timeout = setTimeout(() => unlock(hash), maxLockingTime);
        }
        mutexTickNext();
    }
    function mutexContinue(workerIitem) {
        workerIitem.isRunning = true;
        const message = {
            __mutexMessage__: true,
            hash: workerIitem.hash,
        };
        if (workerIitem.workerId === 'master') {
            MasterHandler.emitter.emit('message', message);
        }
        else {
            cluster.workers[workerIitem.workerId].send(message);
        }
    }
    function unlock(hash) {
        const f = localLocksQueue.find(foundItem => foundItem.hash === hash);
        if (!f) {
            return;
        }
        if (f.timeout) {
            clearTimeout(f.timeout);
        }
        localLocksQueue = localLocksQueue.filter(item => item.hash !== hash);
        mutexTickNext();
    }
    function masterIncomingMessage(message) {
        if (!message.__mutexMessage__ || !message.action) {
            return;
        }
        if (message.action === 'lock') {
            lock(message.key, message.workerId, message.singleAccess, message.hash, message.maxLockingTime);
        }
        else if (message.action === 'unlock') {
            unlock(message.hash);
        }
    }
    function workerUnlockForced(workerId) {
        localLocksQueue
            .filter(i => i.workerId === workerId)
            .forEach(i => unlock(i.hash));
    }
    if (cluster && typeof cluster.on === 'function') {
        Object.keys(cluster.workers).forEach(workerId => {
            cluster.workers[workerId].on('message', masterIncomingMessage);
        });
        cluster.on('fork', worker => {
            worker.on('message', masterIncomingMessage);
        });
        cluster.on('exit', worker => {
            workerUnlockForced(worker.id);
        });
    }
    MasterHandler.masterIncomingMessage = masterIncomingMessage;
}
//# sourceMappingURL=SharedMutex.js.map