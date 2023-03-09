"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutexGlobalStorage = void 0;
const LOCAL_LOCKS_QUEUE_PROPERTY = '__sharedMutex_localLocksQueue__';
const ALREADY_INITIALIZED_PROPERTY = '__sharedMutex_initialized__';
class MutexGlobalStorage {
    static getLocalLocksQueue() {
        if (!global[LOCAL_LOCKS_QUEUE_PROPERTY]) {
            global[LOCAL_LOCKS_QUEUE_PROPERTY] = [];
        }
        return global[LOCAL_LOCKS_QUEUE_PROPERTY];
    }
    static setLocalLocksQueue(items) {
        global[LOCAL_LOCKS_QUEUE_PROPERTY] = items;
    }
    static getInitialized() {
        return !!global[ALREADY_INITIALIZED_PROPERTY];
    }
    static setInitialized() {
        global[ALREADY_INITIALIZED_PROPERTY] = true;
    }
}
exports.MutexGlobalStorage = MutexGlobalStorage;
//# sourceMappingURL=MutexGlobalStorage.js.map