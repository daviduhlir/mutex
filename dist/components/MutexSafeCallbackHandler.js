"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutexSafeCallbackHandler = exports.__mutexSafeCallbackDispose = exports.__mutexSafeCallbackInjector = void 0;
const MutexError_1 = require("../utils/MutexError");
const constants_1 = require("../utils/constants");
exports.__mutexSafeCallbackInjector = Symbol();
exports.__mutexSafeCallbackDispose = Symbol();
class MutexSafeCallbackHandler {
    constructor(fnc, timeout, onStartCallback) {
        this.fnc = fnc;
        this.timeout = timeout;
        this.onStartCallback = onStartCallback;
        this[_a] = (callback) => {
            if (this.unlockCallback) {
                throw new MutexError_1.MutexError(constants_1.ERROR.MUTEX_SAFE_CALLBACK_ALREADY_USED);
            }
            this.unlockCallback = callback;
            if (this.timeout) {
                this.timeoutHandler = setTimeout(() => this.unlock(), this.timeout);
            }
            if (this.onStartCallback) {
                this.onStartCallback(this);
            }
        };
        this[_b] = () => {
            clearTimeout(this.timeoutHandler);
            this.timeoutHandler = null;
            this.unlockCallback = null;
        };
    }
    unlock() {
        clearTimeout(this.timeoutHandler);
        this.timeoutHandler = null;
        if (this.unlockCallback) {
            this.unlockCallback();
        }
    }
}
exports.MutexSafeCallbackHandler = MutexSafeCallbackHandler;
_a = exports.__mutexSafeCallbackInjector, _b = exports.__mutexSafeCallbackDispose;
