import { assert, expect } from 'chai'
import { SharedMutex } from '../dist'
import { delay, RWSimulator } from './utils'

/**
 * Locks with nested keys test
 */
describe('Nested locks', function() {
  it('Simple test #1', async function() {
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

  it('Simple test #2', async function() {
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



  it('Strict, test exception', async function() {
    SharedMutex.initialize({strictMode: true})
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
    SharedMutex.initialize({strictMode: false})
  })


  it('Non strict, continue allowed', async function() {
    SharedMutex.initialize({strictMode: false})

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

  it('Keep locked after exit nested #1', async function() {
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

  it('Keep locked after exit nested #2 (with nested keys)', async function() {
    let marker = ''
    await SharedMutex.lockSingleAccess('root/index', async () => {
      marker += 'A'

      SharedMutex.lockSingleAccess('root/try', async () => {
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


  it('Lock for single access inside of multi access scope', async function() {
    let marker = ''
    await Promise.all([
      SharedMutex.lockMultiAccess('root', async () => {
        marker += 'A'

        await delay(10)

        await SharedMutex.lockSingleAccess('root', async () => {
          marker += 'B'
          await delay(10)
          marker += 'C'
        })

        await delay(10)

        marker += 'D'
      }),
      delay(15, () => SharedMutex.lockMultiAccess('root', async () => {
        marker += 'E'
        await delay(5)
        marker += 'F'
      }))
    ])

    expect(marker).to.equal('ABCEFD')
  })

  it('Nested locks with different keys', async function() {
    let marker = ''
    await Promise.all([
      SharedMutex.lockSingleAccess('slave', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
      SharedMutex.lockSingleAccess('master', async () => {
        marker += 'A'
        await SharedMutex.lockSingleAccess('slave', async () => {
          marker += 'B'
          await delay(5)
          marker += 'C'
        })
        marker += 'D'
      }),
    ])

    expect(marker).to.equal('EAFBCD')
  })

  it('Nested locks with same keys', async function() {
    let marker = ''
    await Promise.all([
      SharedMutex.lockSingleAccess('master', async () => {
        await delay(10)
        marker += 'A'
        await SharedMutex.lockSingleAccess('master', async () => {
          marker += 'B'
          await delay(20)
          marker += 'C'
        })
        marker += 'D'
      }),
      SharedMutex.lockSingleAccess('master', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
    ])

    expect(marker).to.equal('ABCDEF')
  })
})
