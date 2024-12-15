import { assert, expect } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { RWSimulator, delay, flatten } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Simple locks test
 */
describe(`Basic lock tests (${process.env.class})`, function() {
  it('Single access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      TestedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      TestedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.findIndex(i => !i) === -1, 'All results should be true')
  })

  it('Multi access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      Promise.all([
        TestedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
        TestedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
      ]),
      TestedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(flatten(result).findIndex(i => !i) === -1, 'All results should be true')
  })

  it('Exception unlocks and will be propagated', async function() {
    let visited = false
    let errA
    let errB
    try {
      await TestedMutex.lockSingleAccess('mutex', async () => {
        throw new Error('Test')
      })
    } catch(e) {
      errA = e
    }

    try {
      await TestedMutex.lockSingleAccess('mutex', async () => {
        visited = true
      })
    } catch(e) {
      errB = e
    }

    expect(errA.message).to.equal('Test')
    expect(visited).to.equal(true)
  })
})
