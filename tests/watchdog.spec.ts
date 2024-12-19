import { expect } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { delay } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Simple locks test
 */
describe(`Watchdog tests (${process.env.class})`, function() {
  it('Simulate timeout to see reported phase', async function() {
    let receivedLockInfo
    let receivedError

    TestedMutex.setOptions({
      continueOnTimeout: true,
      timeoutHandler: (item) => {
        receivedLockInfo = item
      }
    })

    try {
      await TestedMutex.lockSingleAccess('mutexO', async () => {
        await TestedMutex.lockSingleAccess('mutex', async () => {
          await TestedMutex.watchdog('Phase1')
          await delay(100)
          await TestedMutex.watchdog('Phase2')
          await delay(100)
          await TestedMutex.watchdog('Phase3')
          await delay(100)
          await TestedMutex.watchdog('Phase4')
          await delay(100)
          await TestedMutex.watchdog('Phase5')
          await delay(100)
          await TestedMutex.watchdog('Phase6')
          await delay(100)
          await TestedMutex.watchdog('Phase7')
          await delay(100)
          await TestedMutex.watchdog('Phase8')
          await delay(100)
          await TestedMutex.watchdog('Phase9')
          await delay(100)
          await TestedMutex.watchdog('Phase10')
        }, 500)
      }, 1000)
    } catch (e) {
      receivedError = e
    }

    TestedMutex.setOptions({
      continueOnTimeout: false,
      timeoutHandler: undefined
    })

    expect(receivedError.key).to.equal('MUTEX_LOCK_TIMEOUT')
    const lastPhase = receivedLockInfo.reportedPhases[receivedLockInfo.reportedPhases.length - 1].phase
    expect(lastPhase).to.equal('Phase5')
  })


  it('Timeout unlocks mutex', async function() {

    TestedMutex.setOptions({
      continueOnTimeout: true,
      timeoutHandler: (item) => {}
    })

    let scopeAVisited = false
    let scopeBVisited = false
    let receivedError

    try {
      await Promise.all([
        (async () => {
          await TestedMutex.lockSingleAccess('mutex', async () => {
            scopeAVisited = true
            await delay(2000)
          }, 20)
        })(),
        (async () => {
          await delay(5)
          await TestedMutex.lockSingleAccess('mutex', async () => {
            scopeBVisited = true
            await delay(10)
          }, 50)
        })()
      ])
    } catch(e) {
      receivedError = e
    }

    TestedMutex.setOptions({
      continueOnTimeout: false,
      timeoutHandler: undefined
    })

    expect(receivedError.key).to.equal('MUTEX_LOCK_TIMEOUT')
    expect(scopeAVisited).to.equal(true)
    expect(scopeBVisited).to.equal(true)
  })
})
