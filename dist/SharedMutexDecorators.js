"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexDecorators = void 0;
const SharedMutex_1 = require("./SharedMutex");
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
                    return SharedMutex_1.SharedMutex.lockAccess(key, () => original(...args), singleAccess, maxLockingTime);
                };
            }
            return descriptor;
        };
    }
}
exports.SharedMutexDecorators = SharedMutexDecorators;
//# sourceMappingURL=SharedMutexDecorators.js.map