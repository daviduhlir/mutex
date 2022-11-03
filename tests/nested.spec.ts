import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { delay, RWSimulator } from './utils'

/**
 * Locks with nested keys test
 */
describe('testing nested locks', function() {
  it('nested locks - testing closure', async function() {
    await SharedMutex.lockSingleAccess('root', async () => {
      await delay(10)
      await SharedMutex.lockSingleAccess('root', async () => {
        await delay(10)
      })
    })
  })

  it('nested locks - testing closure #2', async function() {
    const rwSimulator = new RWSimulator()

    SharedMutex.lockSingleAccess('root', async () => {
      const handler = rwSimulator.write()
      await delay(100)
      handler.stop()
    })
    setTimeout(() => {
      SharedMutex.lockSingleAccess('root', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
      })
    }, 20)

    await delay(1000)

  })



  it('nested lock - crash in strict', async function() {
    SharedMutex.strictMode = true
    let error
    try {
      await SharedMutex.lockMultiAccess('root', async () => {
        await delay(10)

        await SharedMutex.lockMultiAccess('root/test', async () => {
          await delay(10)

          await SharedMutex.lockSingleAccess('root/test/ahoj', async () => {
            await delay(10)
          })
        })
      })
    } catch(e) {
      error = e
    }

    assert(!!error, 'Strict mode should reject this orchestration.')
    SharedMutex.strictMode = false
  })


  it('nested lock - non strict, continue allowed', async function() {
    SharedMutex.strictMode = false

    let notFreezeMarker = false

    await Promise.all([
      SharedMutex.lockMultiAccess('root', async () => {
        await delay(10)
        await SharedMutex.lockSingleAccess('root/test', async () => {
          notFreezeMarker = true
          await delay(10)
        })
      }),
      SharedMutex.lockMultiAccess('root', async () => {
        await delay(10)
      })
    ])

    assert(notFreezeMarker, 'root/test should be still accesible as it is nested of root a strict if off.')

  })
})
