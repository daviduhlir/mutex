import { expect, assert } from 'chai'
import { RWSimulator, delay, checkLocksResults } from './utils'

/**
 * Just test if my simulated env working as I expecting
 */
describe('Test utils', function() {
  it('Delay call', async function() {
    let marker = ''

    setTimeout(() => marker += '0', 5)
    setTimeout(() => marker += '1', 15)

    await delay(10, async () => {
      marker += 'A'
      await delay(10)
      marker += 'B'
    })
    marker += 'C'

    expect(marker).to.equal('0A1BC')
  })

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
