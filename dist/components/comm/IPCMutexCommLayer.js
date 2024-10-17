"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCMutexCommLayer = void 0;
const cluster_1 = __importDefault(require("../../utils/cluster"));
const MutexCommLayer_1 = require("./MutexCommLayer");
class IPCMutexCommLayer extends MutexCommLayer_1.MutexCommLayer {
    onClusterMessage(callback) {
        cluster_1.default.on('message', (worker, message) => {
            if (message.__mutexMessage__) {
                callback(worker, message);
            }
        });
    }
    onProcessMessage(callback) {
        process.on('message', (message) => {
            if (message.__mutexMessage__) {
                callback(message);
            }
        });
    }
    workerSend(worker, message) {
        worker.send(Object.assign({ __mutexMessage__: true }, message), err => {
            if (err) {
            }
        });
    }
    processSend(message) {
        var _a, _b;
        (_a = process === null || process === void 0 ? void 0 : process.send) === null || _a === void 0 ? void 0 : _a.call(process, Object.assign(Object.assign({ __mutexMessage__: true }, message), { workerId: (_b = cluster_1.default.worker) === null || _b === void 0 ? void 0 : _b.id }));
    }
}
exports.IPCMutexCommLayer = IPCMutexCommLayer;
//# sourceMappingURL=IPCMutexCommLayer.js.map