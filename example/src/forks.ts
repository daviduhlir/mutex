import { SharedMutexDecorators } from '@david.uhlir/mutex'
import * as cluster from 'cluster';

/**
 * This test will try to run 4 forks, and then they will try to access same scope
 * Expected behaviour is to see, only one worker can be in scope in time.
 */

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

class Test {
  @SharedMutexDecorators.lockSingleAccess('mutex')
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
    await Test.singleAccessTest()
  })()
}
