import { expect, assert } from 'chai'
import { RWSimulator, delay, checkLocksResults } from './utils'
import { MutexSafeCallbackHandler, SharedMutex } from '../dist'

/**
 * Test safe callback rejection
 */
describe('Safe callback test', function() {
  it('Crash on timeout', async function() {
    const safeCallback = new MutexSafeCallbackHandler(async () => delay(1000), 100)
    const result = SharedMutex.lockSingleAccess('mutex', safeCallback, 200)
    assert(result, 'Result should be true')
  })
})
