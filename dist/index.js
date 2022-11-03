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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cluster_1 = __importDefault(require("./utils/cluster"));
const SharedMutexSynchronizer_1 = require("./SharedMutexSynchronizer");
__exportStar(require("./SharedMutex"), exports);
__exportStar(require("./SharedMutexDecorators"), exports);
__exportStar(require("./SecondarySynchronizer"), exports);
if (cluster_1.default.isMaster) {
    SharedMutexSynchronizer_1.SharedMutexSynchronizer.initializeMaster();
}
//# sourceMappingURL=index.js.map