import { assert } from 'chai'
import { DebugGuard, SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

/**
 * Simple locks test
 */
describe('Debugger test', function() {

  it('Test simple debug scopes', async function() {
    const debuggerOutputCollector: string[] = []
    DebugGuard.writeFunction = (...msgs: any[]) => debuggerOutputCollector.push(msgs.map(i => i?.toString?.() || '').join(' '))
    /*DebugGuard.options.logDetail = true
    DebugGuard.options.logEnterScope = false
    DebugGuard.options.logWaitingOutside = false
    DebugGuard.options.logLeaveMinTime = 100
    DebugGuard.options.logContinueMinTime = 100
    SharedMutexSynchronizer.debugWithStack = true*/
    SharedMutexSynchronizer.reportDebugInfo = DebugGuard.reportDebugInfo

    const result = await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        await delay(100)
      }),
      SharedMutex.lockSingleAccess('mutex/deep', async () => {
        await delay(10)
      }),
    ])

    const compare = [
      'MUTEX_DEBUG mutex Entering scope',
      'MUTEX_DEBUG mutex/deep Waiting outside of scope. Posible blockers:  mutex',
      'MUTEX_DEBUG mutex Leaving scope',
      'MUTEX_DEBUG mutex/deep Continue into scope',
      'MUTEX_DEBUG mutex/deep Leaving scope',
    ]

    SharedMutexSynchronizer.reportDebugInfo = () => void 0

    let isSame = debuggerOutputCollector.length === compare.length
    for(let i = 0; i < debuggerOutputCollector.length && isSame; i++) {
      if (!debuggerOutputCollector[i].startsWith(compare[i])) {
        isSame = false
        break
      }
    }

    assert(isSame, 'Debug info should correspond with predefined snapshot')
  })

})
