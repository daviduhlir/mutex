"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecondarySynchronizer = void 0;
const events_1 = require("events");
class SecondarySynchronizer extends events_1.EventEmitter {
    lock(item) { }
    unlock(hash) { }
    continue(item) { }
    get isArbitter() {
        return true;
    }
}
exports.SecondarySynchronizer = SecondarySynchronizer;
//# sourceMappingURL=SecondarySynchronizer.js.map