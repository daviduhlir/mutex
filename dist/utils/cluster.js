"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let cluster = {
    isPrimary: true,
    isWorker: false,
    worker: null,
    workers: null,
    on: null,
};
try {
    cluster = require('node:cluster');
}
catch (e) { }
exports.default = cluster;
//# sourceMappingURL=cluster.js.map