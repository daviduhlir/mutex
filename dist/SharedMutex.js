"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutex = exports.SharedMutexUnlockHandler = void 0;
const clutser_1 = require("./utils/clutser");
const utils_1 = require("./utils/utils");
const SharedMutexSynchronizer_1 = require("./SharedMutexSynchronizer");
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
        const hash = utils_1.randomHash();
        const eventHandler = clutser_1.default.isWorker ? process : SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.emitter;
        const waiter = new Promise((resolve) => {
            const handler = message => {
                if (message.__mutexMessage__ && message.hash === hash) {
                    eventHandler.removeListener('message', handler);
                    resolve(null);
                }
            };
            eventHandler.addListener('message', handler);
        });
        const lockKey = utils_1.parseLockKey(key);
        SharedMutex.sendAction(lockKey, 'lock', hash, {
            maxLockingTime,
            singleAccess,
        });
        await waiter;
        return new SharedMutexUnlockHandler(lockKey, hash);
    }
    static unlock(key, hash) {
        SharedMutex.sendAction(utils_1.parseLockKey(key), 'unlock', hash);
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
            SharedMutexSynchronizer_1.SharedMutexSynchronizer.masterHandler.masterIncomingMessage({
                ...message,
                workerId: 'master',
            });
        }
    }
}
exports.SharedMutex = SharedMutex;
//# sourceMappingURL=SharedMutex.js.map