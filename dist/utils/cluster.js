"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let cluster = {
    isMaster: true,
    isWorker: false,
    worker: null,
    workers: null,
    on: null,
};
try {
    cluster = require('cluster');
}
catch (e) { }
exports.default = cluster;
//# sourceMappingURL=cluster.js.map