"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncLocalStorageMock = void 0;
class AsyncLocalStorageMock {
    constructor() { }
    getStore() {
        return undefined;
    }
    async run(data, fnc) {
        return fnc();
    }
}
exports.AsyncLocalStorageMock = AsyncLocalStorageMock;
let AsyncLocalStorageClass = AsyncLocalStorageMock;
try {
    AsyncLocalStorageClass = require('async_hooks').AsyncLocalStorage;
}
catch (e) { }
exports.default = AsyncLocalStorageClass;
//# sourceMappingURL=AsyncLocalStorage.js.map