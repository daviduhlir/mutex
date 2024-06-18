"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLockKey = exports.sanitizeLock = exports.keysRelatedMatch = exports.isChildOf = exports.randomHash = void 0;
function randomHash() {
    return [...Array(10)]
        .map(x => 0)
        .map(() => Math.random().toString(36).slice(2))
        .join('');
}
exports.randomHash = randomHash;
function isChildOf(key, parentKey) {
    const keyParts = key.split('/');
    const parentKeyParts = parentKey.split('/');
    if (keyParts.length >= parentKeyParts.length) {
        return false;
    }
    for (let i = 0; i < keyParts.length; i++) {
        if (keyParts[i] !== parentKeyParts[i]) {
            return false;
        }
    }
    return true;
}
exports.isChildOf = isChildOf;
function keysRelatedMatch(key1, key2) {
    const key1Parts = (Array.isArray(key1) ? key1 : key1.split('/')).filter(Boolean);
    const key2Parts = (Array.isArray(key2) ? key2 : key2.split('/')).filter(Boolean);
    for (let i = 0; i < Math.min(key1Parts.length, key2Parts.length); i++) {
        if (key1Parts[i] !== key2Parts[i]) {
            return false;
        }
    }
    return true;
}
exports.keysRelatedMatch = keysRelatedMatch;
function sanitizeLock(input) {
    return Object.assign(Object.assign({ workerId: input.workerId, singleAccess: input.singleAccess, hash: input.hash, key: input.key, isRunning: !!input.isRunning, parents: input.parents }, (input.maxLockingTime ? { maxLockingTime: input.maxLockingTime } : {})), (input.timeout ? { timeout: input.timeout } : {}));
}
exports.sanitizeLock = sanitizeLock;
function parseLockKey(key) {
    return ('/' +
        (Array.isArray(key) ? key.join('/') : key)
            .split('/')
            .filter(i => !!i)
            .join('/'));
}
exports.parseLockKey = parseLockKey;
//# sourceMappingURL=utils.js.map