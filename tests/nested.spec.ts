import { assert, expect } from 'chai'
import { SharedMutex } from '../dist'
import { delay, RWSimulator } from './utils'

/**
 * Locks with nested keys test
 */
describe('testing nested locks', function() {
  it('nested locks - testing closure', async function() {
    let marker = ''

    await SharedMutex.lockSingleAccess('root', async () => {
      marker += 'A'
      await delay(10)
      await SharedMutex.lockSingleAccess('root', async () => {
        marker += 'B'
        await delay(10)
        marker += 'C'
      })
      marker += 'D'
    })

    expect(marker).to.equal('ABCD')
  })

  it('nested locks - testing closure #2', async function() {
    const rwSimulator = new RWSimulator()

    let e1: any = 'not called'
    let e2: any = 'not called'

    setTimeout(() => {
      SharedMutex.lockSingleAccess('root', async () => {
        try {
          const handler = rwSimulator.write()
          await delay(10)
          handler.stop()
          e1 = null
        } catch(error) {
          e1 = error
        }
      })
    }, 50)

    await SharedMutex.lockSingleAccess('root', async () => {
      try {
        const handler = rwSimulator.write()
        await delay(100)
        handler.stop()
        e2 = null
      } catch(error) {
        e2 = error
      }
    })

    await delay(120)

    assert(!e1 && !e2, 'Should ends without any error')
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

  it('nested lock - not awaited', async function() {
    let marker = ''
    await SharedMutex.lockSingleAccess('root', async () => {
      marker += 'A'

      SharedMutex.lockSingleAccess('root', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await SharedMutex.lockSingleAccess('root', async () => {
      marker += 'E'
      await delay(110)
      marker += 'F'
    })

    expect(marker).to.equal('ABDCEF')
  })

  it('nested lock - not awaited with keys', async function() {
    let marker = ''
    await SharedMutex.lockSingleAccess('root/index', async () => {
      marker += 'A'

      SharedMutex.lockSingleAccess('root/pokus', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await SharedMutex.lockSingleAccess('root/index', async () => {
      marker += 'E'
      await delay(10)
      marker += 'F'
    })

    await delay(100)

    expect(marker).to.equal('ABDEFC')
  })
})
