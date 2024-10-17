"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStackFrom = void 0;
const SharedMutexSynchronizer_1 = require("../components/SharedMutexSynchronizer");
function getStackFrom(getFrom) {
    if (!SharedMutexSynchronizer_1.SharedMutexSynchronizer.debugWithStack) {
        return null;
    }
    let codeStack;
    const e = new Error();
    codeStack = e.stack;
    const stackLines = codeStack.split('\n');
    const found = stackLines.findIndex(line => line.trim().includes(`${getFrom}`));
    return found !== -1 ? stackLines.slice(found + 1).join('\n') : null;
}
exports.getStackFrom = getStackFrom;
//# sourceMappingURL=stack.js.map