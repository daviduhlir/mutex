import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay, flatten } from './utils'

/**
 * Simple locks test
 */
describe('Basic lock tests', function() {
  it('Multiple related keys', async function() {
    await SharedMutex.lockSingleAccess('TargetCachedAction-TargetGetBuildErrorsAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {
      await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
        await SharedMutex.lockSingleAccess('TargetCachedAction-TargetBuildAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {
          await SharedMutex.lockSingleAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
            await delay(10)
            await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
              await SharedMutex.lockSingleAccess('TargetCachedAction-TargetBuildAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {
                await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main/src/styles/overstyle.less', async () => {
                  await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
                    await delay(10)
                  })
                })
              })
            })
            await delay(10)
            SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
              await delay(10)
              await SharedMutex.lockSingleAccess('TargetCachedAction-TargetBuildAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {
                await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main/src/styles/overstyle.less', async () => {
                  await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
                    await delay(10)
                  })
                })
              })
            })
            SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
              await SharedMutex.lockSingleAccess('TargetCachedAction-TargetBuildAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {
                await delay(10)
                await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main/src/styles/overstyle.less', async () => {
                  await SharedMutex.lockMultiAccess('/targets/Users/daviduhlir/Documents/Work/zenoo/hub-design-studio/temp/targets/d5001cb170d7b90c39702fc4e7ef79db5908b8cadfbaeac93715a53cf6db0210-main', async () => {
                    await delay(10)
                  })
                })
              })
            })
          })
        })
      })
    })




    await SharedMutex.lockSingleAccess('TargetCachedAction-TargetGetBuildErrorsAction-989db2448f309bfdd99b513f37c84b8f5794d2b5', async () => {})
  })
})
