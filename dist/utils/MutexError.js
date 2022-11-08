"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutexError = void 0;
class MutexError extends Error {
    constructor(key, message = '') {
        super(key);
        this.key = key;
        this.message = message;
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            ;
            this.__proto__ = actualProto;
        }
    }
}
exports.MutexError = MutexError;
//# sourceMappingURL=MutexError.js.map