import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { delay } from './utils'

/**
 * Locks with nested keys test
 */
describe('Stress test', function() {
  it('Big amount in parallel with interval multi access', async function() {

    let failed = false

    let counter = 0
    const int = setInterval(() => SharedMutex.lockMultiAccess('root', async () => {
      counter++
      await delay(2)
      counter--
    }), 1)

    await Promise.all(new Array(100).fill(null).map(() =>
      SharedMutex.lockSingleAccess('root', async () => {
        if (counter !== 0) {
          failed = true
        }
        counter++
        await delay(1)
        counter--
      })))

    clearInterval(int)

    assert(!failed, 'Single access scope should not be penetrated with any other')
  })

})
