"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Awaiter = void 0;
class Awaiter {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolver = resolve;
            this.rejector = reject;
        });
    }
    static wrap(promise) {
        const awaiter = new Awaiter();
        promise.then(result => awaiter.resolve(result), error => awaiter.reject(error));
        return awaiter;
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
    resolve(result) {
        this.finished = true;
        if (this.resolver) {
            this.resolver(result);
        }
    }
    reject(error) {
        this.finished = true;
        if (this.rejector) {
            this.rejector(error);
        }
    }
}
exports.Awaiter = Awaiter;
//# sourceMappingURL=Awaiter.js.map