import { assert } from 'chai'
import { DebugGuard, SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

/**
 * Simple locks test
 */
describe('Leaks test', function() {

  it('Test scopes and count whats left', async function() {
    const debuggerOutputCollector: string[] = []
    DebugGuard.writeFunction = (...msgs: any[]) => debuggerOutputCollector.push(msgs.map(i => i?.toString?.() || '').join(' '))
    SharedMutexSynchronizer.reportDebugInfo = DebugGuard.reportDebugInfo

    const before = SharedMutexSynchronizer.getLocksCount()

    await Promise.all(
      new Array(2).fill(null).map(() =>
        SharedMutex.lockSingleAccess('mutex/deep', async () => {
          await delay(10)
        }),
      )
    .concat(
      new Array(2).fill(null).map(() =>
        SharedMutex.lockMultiAccess('mutex', async () => {
          await delay(10)
        }),
      )
    ))

    const after = SharedMutexSynchronizer.getLocksCount()

    SharedMutexSynchronizer.reportDebugInfo = () => void 0

    assert(before === after && before === 0, 'Locks count before and after test should be 0')
  })

})
