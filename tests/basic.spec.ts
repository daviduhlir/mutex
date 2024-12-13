import { assert } from 'chai'
import { Mutex } from '../dist'
import { RWSimulator, delay, flatten } from './utils'

//SharedMutexSynchronizer.debugWithStack = true
/**
 * Simple locks test
 */
describe('Basic lock tests', function() {
  it('Single access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      Mutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      Mutex.lockSingleAccess('mutex', async () => {
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
        Mutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
        Mutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
      ]),
      Mutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(flatten(result).findIndex(i => !i) === -1, 'All results should be true')
  })
})
