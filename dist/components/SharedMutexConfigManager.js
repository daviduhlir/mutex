"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMutexConfigManager = exports.defaultConfiguration = void 0;
const IPCMutexCommLayer_1 = require("./comm/IPCMutexCommLayer");
const Awaiter_1 = require("../utils/Awaiter");
exports.defaultConfiguration = {
    defaultMaxLockingTime: undefined,
    communicationLayer: 'IPC',
};
class SharedMutexConfigManager {
    static initialize(configuration) {
        if (configuration) {
            SharedMutexConfigManager.configuration = Object.assign(Object.assign({}, exports.defaultConfiguration), configuration);
        }
        if (SharedMutexConfigManager.configuration.communicationLayer === 'IPC') {
            SharedMutexConfigManager.comm = new IPCMutexCommLayer_1.IPCMutexCommLayer();
        }
        else {
            SharedMutexConfigManager.comm = SharedMutexConfigManager.configuration.communicationLayer;
        }
        if (!SharedMutexConfigManager.comm) {
            SharedMutexConfigManager.initAwaiter = new Awaiter_1.Awaiter();
            return false;
        }
        SharedMutexConfigManager.initAwaiter.resolve();
        return true;
    }
    static async getComm() {
        await SharedMutexConfigManager.initAwaiter.wait();
        return SharedMutexConfigManager.comm;
    }
    static async getConfiguration() {
        await SharedMutexConfigManager.initAwaiter.wait();
        return SharedMutexConfigManager.configuration;
    }
    static async getUsingDefaultConfig() {
        await SharedMutexConfigManager.initAwaiter.wait();
        return SharedMutexConfigManager.configuration === exports.defaultConfiguration;
    }
}
exports.SharedMutexConfigManager = SharedMutexConfigManager;
SharedMutexConfigManager.configuration = exports.defaultConfiguration;
SharedMutexConfigManager.initAwaiter = new Awaiter_1.Awaiter();
//# sourceMappingURL=SharedMutexConfigManager.js.map