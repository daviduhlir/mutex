import { expect, assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay } from './utils'

/**
 * Just test if my simulated env working as I expecting
 */
describe('test rw simulator', function() {
  it('lock handling', async function() {
    const rwSimulator = new RWSimulator()
    try {
      await Promise.all([
        (async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        })(),
        (async () => {
          const handler = rwSimulator.write()
          await delay(10)
          handler.stop()
          return true
        })(),
      ])
      assert(false, 'Should fails on lock error.')
    } catch(e) {
      expect(e.toString()).to.equal('Error: Already locked for read.')
    }
  })
})

/**
 * Simple locks test
 */
describe('lock test', function() {
  it('single access', async function() {
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

  it('multi access', async function() {
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
    assert(result.flat().findIndex(i => !i) === -1, 'All results should be true')
  })
})
