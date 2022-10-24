import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { delay } from './utils'

SharedMutex.warningThrowsError = true

/**
 * Locks with nested keys test
 */
describe('testing nested locks', function() {
  it('nested lock - same key', async function() {

    try {
      await SharedMutex.lockMultiAccess('root', async () => {
        await delay(10)

        await SharedMutex.lockMultiAccess('root', async () => {
          await delay(10)

          await SharedMutex.lockSingleAccess('root', async () => {
            await delay(10)
          })
        })

        assert(false, 'Should crash on nested locks error.')
      })
    } catch(e) {}
  })
})
