import { expect } from 'chai'
import { SharedMutex } from '../dist'
import { delay } from './utils'

/**
 * Simple locks test
 */
describe('Debug test', function() {
  before(function() {
    SharedMutex.setOptions({
      debugDeadEnds: true
    })
  })

  it('Dead end detection', async function() {
    async function tt() {
      await SharedMutex.lockMultiAccess('root', async () => {
        await SharedMutex.lockSingleAccess('root', async () => {
          await delay(10)
        })
      })
    }

    try {
      await Promise.all([
        tt(),
        tt(),
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

  it('Dead end detection #2', async function() {
    try {
      await Promise.all([
        SharedMutex.lockMultiAccess('root', async () => {
          await SharedMutex.lockMultiAccess('root', async () => {
            await SharedMutex.lockSingleAccess('root', async () => {
              await delay(5000)
            })
          })
        }),
        SharedMutex.lockMultiAccess('root', async () => {
          await SharedMutex.lockSingleAccess('root', async () => {
            await delay(10)
          })
        })
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

  it('Dead end detection #3', async function() {
    try {
      await Promise.all([
        (async () => {
          await SharedMutex.lockSingleAccess('A', async () => {
            await SharedMutex.lockMultiAccess('B', async () => {
              await delay(1000)
            })
          })
        })(),
        (async () => {
          await SharedMutex.lockSingleAccess('B', async () => {
            await SharedMutex.lockMultiAccess('A', async () => {
              await delay(1000)
            })
          })
        })()
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

  it('Dead end detection #4', async function() {
    try {
      await Promise.all([
        (async () => {
          await SharedMutex.lockMultiAccess('A', async () => {
            await SharedMutex.lockSingleAccess('B', async () => {
              await delay(1000)
            })
          })
        })(),
        (async () => {
          await SharedMutex.lockMultiAccess('B', async () => {
            await SharedMutex.lockSingleAccess('A', async () => {
              await delay(1000)
            })
          })
        })()
      ])
    } catch(e) {
      expect(e.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
    }
  })

})
