"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SharedMutex_1 = require("../SharedMutex");
const cluster = require("cluster");
function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
async function test(name, fnc) {
    await SharedMutex_1.SharedMutex.lockSingleAccess(name, async () => {
        console.log(process.env.i, 'Lock ' + name);
        if (fnc) {
            await fnc();
        }
    });
    console.log(process.env.i, 'Unlock ' + name);
}
if (cluster.isMaster) {
    for (let i = 0; i < 5; i++) {
        cluster.fork({ i });
    }
}
else {
    (async function () {
        await test('root/test/' + process.env.i, async () => {
            await test('root/test/nested', async () => {
                await delay(1000);
            });
        });
    })();
}
//# sourceMappingURL=index.js.map