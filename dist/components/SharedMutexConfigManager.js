"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    static getComm() {
        return __awaiter(this, void 0, void 0, function* () {
            yield SharedMutexConfigManager.initAwaiter.wait();
            return SharedMutexConfigManager.comm;
        });
    }
    static getConfiguration() {
        return __awaiter(this, void 0, void 0, function* () {
            yield SharedMutexConfigManager.initAwaiter.wait();
            return SharedMutexConfigManager.configuration;
        });
    }
    static getUsingDefaultConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            yield SharedMutexConfigManager.initAwaiter.wait();
            return SharedMutexConfigManager.configuration === exports.defaultConfiguration;
        });
    }
}
exports.SharedMutexConfigManager = SharedMutexConfigManager;
SharedMutexConfigManager.configuration = exports.defaultConfiguration;
SharedMutexConfigManager.initAwaiter = new Awaiter_1.Awaiter();
