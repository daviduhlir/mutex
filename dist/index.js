"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutexSafeCallbackHandler = void 0;
const SharedMutex_1 = require("./SharedMutex");
__exportStar(require("./SharedMutex"), exports);
__exportStar(require("./components/SharedMutexDecorators"), exports);
__exportStar(require("./components/SharedMutexSynchronizer"), exports);
__exportStar(require("./components/DebugGuard"), exports);
__exportStar(require("./components/comm/MutexCommLayer"), exports);
__exportStar(require("./utils/interfaces"), exports);
__exportStar(require("./utils/Awaiter"), exports);
var MutexSafeCallbackHandler_1 = require("./components/MutexSafeCallbackHandler");
Object.defineProperty(exports, "MutexSafeCallbackHandler", { enumerable: true, get: function () { return MutexSafeCallbackHandler_1.MutexSafeCallbackHandler; } });
SharedMutex_1.SharedMutex.initialize();
//# sourceMappingURL=index.js.map