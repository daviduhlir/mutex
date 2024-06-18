import { assert } from 'chai'
import { DebugGuard, SharedMutex, SharedMutexSynchronizer } from '../dist'
import { delay } from './utils'

/**
 * Simple locks test
 */
describe('Real cases', function() {
  it('Nested locks with relevant paths', async function() {
    await SharedMutex.lockSingleAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main', async () => {
      return SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/node_modules/@zenoo/hub-client-components', async () => {
        return SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/node_modules/@zenoo/hub-design-studio-core', async () => {
          await delay(10)
        })
      })
    })
  })
})
