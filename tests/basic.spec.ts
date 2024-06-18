import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay, flatten } from './utils'

/**
 * Simple locks test
 */
describe('Basic lock tests', function() {
  it('Multiple related keys', async function() {
    const result = await Promise.all([
      SharedMutex.lockSingleAccess('/A/B/C/D', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/A/B', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/B/C', async () => {
        await SharedMutex.lockSingleAccess('/B/C/D', async () => {
          await SharedMutex.lockSingleAccess('/', async () => {
            await delay(10)
          })
        })
      }),
      SharedMutex.lockSingleAccess('/A/B/C', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/C/D', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/C', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/A', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/A/B/C/D/E', async () => {
        await delay(10)
      }),
      SharedMutex.lockSingleAccess('/A', async () => {
        await delay(10)
      }),
    ])
    //assert(result.findIndex(i => !i) === -1, 'All results should be true')
  })



  it('Single access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
      SharedMutex.lockSingleAccess('mutex', async () => {
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
        SharedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
        SharedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
      ]),
      SharedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(flatten(result).findIndex(i => !i) === -1, 'All results should be true')
  })
})
