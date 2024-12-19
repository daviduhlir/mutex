import { assert } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { RWSimulator, delay } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Locks with nested keys test
 */
describe(`Lock keys (${process.env.class})`, function() {
  it('Lock parent key', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      TestedMutex.lockSingleAccess('root/mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      TestedMutex.lockSingleAccess('root', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.findIndex(i => !i) === -1, 'All results should be true')
  })

  it('Lock child key', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      TestedMutex.lockSingleAccess('root', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      TestedMutex.lockSingleAccess('root/mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.findIndex(i => !i) === -1, 'All results should be true')
  })
})
