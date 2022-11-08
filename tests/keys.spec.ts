import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay } from './utils'

/**
 * Locks with nested keys test
 */
describe('Lock keys', function() {
  it('Lock parent key', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      SharedMutex.lockSingleAccess('root/mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      SharedMutex.lockSingleAccess('root', async () => {
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
      SharedMutex.lockSingleAccess('root', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      SharedMutex.lockSingleAccess('root/mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.findIndex(i => !i) === -1, 'All results should be true')
  })
})
