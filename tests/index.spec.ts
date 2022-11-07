import { expect, assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay, flatten, checkLocksResults } from './utils'

/**
 * Just test if my simulated env working as I expecting
 */
describe('test simulators', function() {
  it('RW simulator', async function() {
    const rwSimulator = new RWSimulator()
    try {
      await Promise.all([
        (async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
        })(),
        (async () => {
          const handler = rwSimulator.write()
          await delay(10)
          handler.stop()
        })(),
      ])
      assert(false, 'Should fails on lock error.')
    } catch(e) {
      expect(e.toString()).to.equal('Error: Already locked for read.')
    }
  })

  it('Locks result check #1', async function() {
    try {
      const expected = [
        'S:L', 'S:U', 'M:L',
        'M:L', 'M:L', 'M:L',
        'M:U', 'M:U', 'M:U',
        'M:U'
      ]
      checkLocksResults(expected)
    } catch(e) {
      assert(!e, 'Result should be without error.')
    }
  })

  it('Locks result check #2', async function() {
    try {
      const expected = [
        'S:L', 'S:U', 'M:L',
        'A:L', 'M:L', 'M:L',
        'M:U'
      ]
      checkLocksResults(expected)
      assert(false, 'Should fails on test error.')
    } catch(e) {
      expect(e.toString()).to.equal('Error: Something is opened on the end of test')
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
    assert(flatten(result).findIndex(i => !i) === -1, 'All results should be true')
  })
})
