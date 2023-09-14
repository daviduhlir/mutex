"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutexSafeCallbackHandler = exports.__mutexSafeCallbackDispose = exports.__mutexSafeCallbackInjector = void 0;
const MutexError_1 = require("../utils/MutexError");
const constants_1 = require("../utils/constants");
exports.__mutexSafeCallbackInjector = Symbol();
exports.__mutexSafeCallbackDispose = Symbol();
class MutexSafeCallbackHandler {
    constructor(fnc, timeout) {
        this.fnc = fnc;
        this.timeout = timeout;
    }
    unlock() {
        clearTimeout(this.timeoutHandler);
        this.timeoutHandler = null;
        if (this.unlockCallback) {
            this.unlockCallback();
        }
    }
    [exports.__mutexSafeCallbackInjector](callback) {
        if (this.unlockCallback) {
            throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_SAFE_CALLBACK_ALREADY_USED);
        }
        this.unlockCallback = callback;
        if (this.timeout) {
            this.timeoutHandler = setTimeout(this.unlock, this.timeout);
        }
    }
    [exports.__mutexSafeCallbackDispose]() {
        clearTimeout(this.timeoutHandler);
        this.timeoutHandler = null;
        this.unlockCallback = null;
    }
}
exports.MutexSafeCallbackHandler = MutexSafeCallbackHandler;
//# sourceMappingURL=MutexSafeCallbackHandler.js.map