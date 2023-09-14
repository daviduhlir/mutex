import { SharedMutex, SharedMutexDecorators } from '@david.uhlir/mutex'


/**
 * This test will generaly show, how can you use locks and decorators
 * This test is working only under master (no forks will be launched)
 */

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

class Test {
  @SharedMutexDecorators.lockSingleAccess('mutex')
  static async singleAccessTest(name: string, delayTime: number = 1000) {
    console.log(`Lock single ${name}`)
    await delay(delayTime)
    console.log(`Unlock single ${name}`)
  }

  @SharedMutexDecorators.lockMultiAccess('mutex')
  static async multiAccessTest(name: string, delayTime: number = 1000) {
    console.log(`Lock multi ${name}`)
    await delay(delayTime)
    console.log(`Unlock multi ${name}`)
  }
}

;(async function () {
  console.log('----Running single access test----\n')

  await Promise.all([
    SharedMutex.lockSingleAccess('mutex', async () => {
      console.log('Lock single test 1')
      await delay(1000)
      console.log('Unlock single test 1')
    }),
    SharedMutex.lockSingleAccess('mutex', async () => {
      console.log('Lock single test 2')
      await delay(1000)
      console.log('Unlock single test 2')
    }),
  ])

  console.log('\n----Running multi access test----\n')

  await Promise.all([
    SharedMutex.lockMultiAccess('mutex', async () => {
      console.log('Lock multi test 1')
      await delay(1000)
      console.log('Unlock multi test 1')
    }),
    SharedMutex.lockMultiAccess('mutex', async () => {
      console.log('Lock multi test 2')
      await delay(1000)
      console.log('Unlock multi test 2')
    }),
    SharedMutex.lockSingleAccess('mutex', async () => {
      console.log('Lock single test 2')
      await delay(1000)
      console.log('Unlock single test 2')
    }),
  ])

  console.log('\n----Running decorators single access test----\n')

  await Promise.all([Test.singleAccessTest('test 1'), Test.singleAccessTest('test 2')])

  console.log('\n----Running decorators  multi access test----\n')

  await Promise.all([Test.multiAccessTest('test 1'), Test.multiAccessTest('test 2'), Test.singleAccessTest('test 3')])

  console.log('\n----Timeout test----\n')

  await Promise.all([
    SharedMutex.lockSingleAccess('mutex', async () => {
      console.log('Lock single test 2')
      await delay(10000)
      console.log('Unlock single test 2')
    }, 100),
  ])
})()
