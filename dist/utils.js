"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeLock = exports.isChildOf = exports.getAllKeys = exports.randomHash = void 0;
function randomHash() {
    return [...Array(10)]
        .map(x => 0)
        .map(() => Math.random().toString(36).slice(2))
        .join('');
}
exports.randomHash = randomHash;
function getAllKeys(key) {
    return key
        .split('/')
        .filter(Boolean)
        .reduce((acc, item, index, array) => {
        return [...acc, array.slice(0, index + 1).join('/')];
    }, []);
}
exports.getAllKeys = getAllKeys;
function isChildOf(key, parentKey) {
    const childKeys = getAllKeys(key);
    const index = childKeys.indexOf(parentKey);
    if (index !== -1 && index !== childKeys.length - 1) {
        return true;
    }
    return false;
}
exports.isChildOf = isChildOf;
function sanitizeLock(input) {
    return {
        workerId: input.workerId,
        singleAccess: input.singleAccess,
        hash: input.hash,
        key: input.key,
        isRunning: !!input.isRunning,
        ...(input.maxLockingTime ? { maxLockingTime: input.maxLockingTime } : {}),
        ...(input.timeout ? { timeout: input.timeout } : {}),
    };
}
exports.sanitizeLock = sanitizeLock;
//# sourceMappingURL=utils.js.map