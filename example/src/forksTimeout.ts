import { SharedMutexDecorators } from '@david.uhlir/mutex'
import * as cluster from 'cluster';

/**
 * This test will try to run 4 forks, and it should fails on timeout.
 * Expected behaviour is this timeout will be catched by default handler, and will kill forks.
 */

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

class Test {
  @SharedMutexDecorators.lockSingleAccess('mutex', 800)
  static async singleAccessTest(delayTime: number = 500) {
    console.log(`Worker: ${process.env.index} Lock`)
    await delay(delayTime)
    console.log(`Worker: ${process.env.index} Unlock`)
  }
}

if (cluster.isMaster) {
  console.log(`----Running forks test----\n`)
  for(let index = 0; index < 4; index++) {
    cluster.fork({ index })
  }
} else {
  ;(async function () {
    await Test.singleAccessTest(10000)
  })()
}
