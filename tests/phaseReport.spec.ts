import { assert } from 'chai'
import { SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

SharedMutexSynchronizer.debugWithStack = true
/**
 * Simple locks test
 */
describe('Phase report tests', function() {
  it('Simulate timeout to see reported phase', async function() {
    await SharedMutex.lockSingleAccess('mutexO', async () => {
      await SharedMutex.lockSingleAccess('mutex', async () => {
        SharedMutex.reportPhase('Phase1')
        await delay(200)
        SharedMutex.reportPhase('Phase2')
        await delay(200)
        SharedMutex.reportPhase('Phase3')
        await delay(200)
        SharedMutex.reportPhase('Phase4')
        await delay(200)
        SharedMutex.reportPhase('Phase5')
        await delay(200)
        SharedMutex.reportPhase('Phase6')
      }, 1000)
    }, 1000)
  })
})
