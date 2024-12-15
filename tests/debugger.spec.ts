import { expect } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { delay } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Simple locks test
 */
describe(`Debug test (${process.env.class})`, function() {
  before(function() {
    TestedMutex.setOptions({
      debugDeadEnds: true
    })
  })

  it('Dead end detection', async function() {
    async function tt() {
      await TestedMutex.lockMultiAccess('root', async () => {
        await TestedMutex.lockSingleAccess('root', async () => {
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
        TestedMutex.lockMultiAccess('root', async () => {
          await TestedMutex.lockMultiAccess('root', async () => {
            await TestedMutex.lockSingleAccess('root', async () => {
              await delay(5000)
            })
          })
        }),
        TestedMutex.lockMultiAccess('root', async () => {
          await TestedMutex.lockSingleAccess('root', async () => {
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
          await TestedMutex.lockSingleAccess('A', async () => {
            await TestedMutex.lockMultiAccess('B', async () => {
              await delay(1000)
            })
          })
        })(),
        (async () => {
          await TestedMutex.lockSingleAccess('B', async () => {
            await TestedMutex.lockMultiAccess('A', async () => {
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
          await TestedMutex.lockMultiAccess('A', async () => {
            await TestedMutex.lockSingleAccess('B', async () => {
              await delay(1000)
            })
          })
        })(),
        (async () => {
          await TestedMutex.lockMultiAccess('B', async () => {
            await TestedMutex.lockSingleAccess('A', async () => {
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
