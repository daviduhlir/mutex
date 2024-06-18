"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Awaiter = void 0;
class Awaiter {
    constructor() {
        this.promise = new Promise(resolve => (this.resolver = resolve));
    }
    async wait() {
        if (this.finished) {
            return;
        }
        return this.promise;
    }
    get resolved() {
        return this.finished;
    }
    resolve() {
        this.finished = true;
        if (this.resolver) {
            this.resolver();
        }
    }
}
exports.Awaiter = Awaiter;
//# sourceMappingURL=Awaiter.js.map