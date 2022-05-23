import { SharedMutex } from '@david.uhlir/mutex';
import * as cluster from 'cluster'

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

async function test(name: string, fnc?: () => Promise<void>) {
  await SharedMutex.lockSingleAccess(name, async () => {
    console.log(process.env.i, 'Lock ' + name)
    if (fnc) {
      await fnc()
    }
  })
  console.log(process.env.i, 'Unlock ' + name)
}

if (cluster.isMaster) {
  for (let i = 0; i < 5; i++) {
    cluster.fork({i})
  }
} else {
  (async function() {
    await test('root/test/' + process.env.i, async () => {
      await test('root/test/nested', async () => {
        await delay(1000)
      })
    })
  })()
}