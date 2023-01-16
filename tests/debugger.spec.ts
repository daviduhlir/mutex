import { assert } from 'chai'
import { DebugGuard, SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

/**
 * Simple locks test
 */
describe('Debugger test', function() {

  it('Test simple debug scopes', async function() {
    let debuggerOutputCollector = ''
    DebugGuard.writeFunction = (...msgs: any[]) => debuggerOutputCollector += msgs.map(i => i.toString()).join(' ') + '\n'
    SharedMutexSynchronizer.reportDebugInfo = DebugGuard.reportDebugInfo

    const result = await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('mutex/deep', async () => {
        await delay(10)
      }),
    ])

    const compare = `MUTEX_DEBUG mutex Entering scope
    MUTEX_DEBUG mutex/deep Waiting outside of scope. Posible blockers:  mutex
    MUTEX_DEBUG mutex Leaving scope
    MUTEX_DEBUG mutex/deep Continue into scope
    MUTEX_DEBUG mutex/deep Leaving scope`

    SharedMutexSynchronizer.reportDebugInfo = () => void 0

    assert(debuggerOutputCollector !== compare, 'Debug info should correspond with predefined snapshot')
  })

})
