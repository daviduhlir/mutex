import { expect } from 'chai'
import { SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

SharedMutexSynchronizer.debugWithStack = true
/**
 * Simple locks test
 */
describe('Watchdog tests', function() {
  it('Simulate timeout to see reported phase', async function() {
    let receivedLockInfo
    let receivedError
    const originalHandler = SharedMutexSynchronizer.timeoutHandler
    SharedMutexSynchronizer.timeoutHandler = (hash: string) => {
      receivedLockInfo = SharedMutexSynchronizer.getLockInfo(hash)
    }
    try {
      await SharedMutex.lockSingleAccess('mutexO', async () => {
        await SharedMutex.lockSingleAccess('mutex', async () => {
          await SharedMutex.watchdog('Phase1')
          await delay(200)
          await SharedMutex.watchdog('Phase2')
          await delay(200)
          await SharedMutex.watchdog('Phase3')
          await delay(200)
          await SharedMutex.watchdog('Phase4')
          await delay(200)
          await SharedMutex.watchdog('Phase5')
          await delay(200)
          await SharedMutex.watchdog('Phase6')
          await delay(200)
          await SharedMutex.watchdog('Phase7')
          await delay(200)
          await SharedMutex.watchdog('Phase8')
          await delay(200)
          await SharedMutex.watchdog('Phase9')
          await delay(200)
          await SharedMutex.watchdog('Phase10')
        }, 1000)
      }, 1000)
    } catch (e) {
      receivedError = e
    }

    SharedMutexSynchronizer.timeoutHandler = originalHandler

    expect(receivedError.message).to.equal('MUTEX_WATCHDOG_REJECTION')
    const lastPhase = receivedLockInfo.reportedPhases[receivedLockInfo.reportedPhases.length - 1].phase
    expect(lastPhase).to.equal('Phase5')
  })


  it('Timeout unlocks mutex', async function() {
    const originalHandler = SharedMutexSynchronizer.timeoutHandler
    SharedMutexSynchronizer.timeoutHandler = (hash: string) => {}

    let scopeBVisited = false

    await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        await delay(2000)
      }, 10),
      SharedMutex.lockSingleAccess('mutex/b', async () => {
        scopeBVisited = true
        await delay(10)
      }, 50)
    ])

    expect(scopeBVisited).to.equal(true)

    SharedMutexSynchronizer.timeoutHandler = originalHandler
  })
})
