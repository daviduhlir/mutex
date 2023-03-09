"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const SharedMutex_1 = require("./SharedMutex");
__exportStar(require("./SharedMutex"), exports);
__exportStar(require("./SharedMutexDecorators"), exports);
__exportStar(require("./SecondarySynchronizer"), exports);
__exportStar(require("./SharedMutexSynchronizer"), exports);
__exportStar(require("./DebugGuard"), exports);
__exportStar(require("./comm/MutexCommLayer"), exports);
__exportStar(require("./utils/interfaces"), exports);
SharedMutex_1.SharedMutex.initialize();
//# sourceMappingURL=index.js.map