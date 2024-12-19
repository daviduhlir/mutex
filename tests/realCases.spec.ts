import { Mutex, SharedMutex } from '../dist'
import { delay } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Simple locks test
 */
describe(`Real cases (${process.env.class})`, function() {
  it('Nested locks with relevant paths', async function() {
    await TestedMutex.lockSingleAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main', async () => {
      return TestedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/node_modules/@zenoo/hub-client-components', async () => {
        return TestedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/targets/du-dev-test-38/main/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/node_modules/@zenoo/hub-design-studio-core', async () => {
          await delay(10)
        })
      })
    })
  })

  it('Combination of key #1', async function() {
    await Promise.all([
      TestedMutex.lockSingleAccess('hello', async () => {
        await TestedMutex.lockSingleAccess('/main', async () => {
          await TestedMutex.lockSingleAccess('/main', async () => {
            await delay(10)
          })
        })
      }),
      TestedMutex.lockSingleAccess('hello', async () => {
        await TestedMutex.lockSingleAccess('/main', async () => {
          await TestedMutex.lockSingleAccess('hello', async () => {
            await delay(10)
          })
        })
      }),
      TestedMutex.lockSingleAccess('hello', async () => {
        await TestedMutex.lockSingleAccess('/main', async () => {
          await TestedMutex.lockSingleAccess('hello', async () => {
            await delay(10)
          })
        })
      }),
      TestedMutex.lockSingleAccess('hello', async () => {
        await TestedMutex.lockSingleAccess('/main', async () => {
          await TestedMutex.lockSingleAccess('hello', async () => {
            await delay(10)
          })
        })
      }),
      TestedMutex.lockSingleAccess('/main/nested/something', async () => {
        await delay(100)
      })
    ])
  })
})
