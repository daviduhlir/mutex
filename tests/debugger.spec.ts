import { assert, expect } from 'chai'
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
      'MUTEX_DEBUG /mutex (S) Entering scope',
      'MUTEX_DEBUG /mutex/deep (S) Waiting outside of scope. Posible blockers:  /mutex',
      'MUTEX_DEBUG /mutex (S) Leaving scope',
      'MUTEX_DEBUG /mutex/deep (S) Continue into scope',
      'MUTEX_DEBUG /mutex/deep (S) Leaving scope',
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

  it('Dead end detection', async function() {
    SharedMutexSynchronizer.debugDeadEnds = true
    async function tt() {
      await SharedMutex.lockMultiAccess('root', async () => {
        await SharedMutex.lockSingleAccess('root', async () => {
          await delay(10)
        })
      })
    }

    try {
      await Promise.all([
        tt(),
        tt(),
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

  it('Dead end detection #2', async function() {
    SharedMutexSynchronizer.debugDeadEnds = true
    await SharedMutex.initialize({
      continueOnTimeout: true
    })
    try {
      await Promise.all([
        SharedMutex.lockMultiAccess('root', async () => {
          await SharedMutex.lockMultiAccess('root', async () => {
            await SharedMutex.lockSingleAccess('root', async () => {
              await delay(5000)
            })
          })
        }),
        SharedMutex.lockMultiAccess('root', async () => {
          await SharedMutex.lockSingleAccess('root', async () => {
            await delay(10)
          })
        })
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }

    await SharedMutex.initialize({
      continueOnTimeout: false
    })
  })

  it('Dead end detection #3', async function() {
    SharedMutexSynchronizer.debugDeadEnds = true
    try {
      await Promise.all([
        (async () => {
          await SharedMutex.lockSingleAccess('A', async () => {
            await SharedMutex.lockMultiAccess('B', async () => {
              await delay(1000)
            })
          })
        })(),
        (async () => {
          await SharedMutex.lockSingleAccess('B', async () => {
            await SharedMutex.lockMultiAccess('A', async () => {
              await delay(1000)
            })
          })
        })()
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

})
