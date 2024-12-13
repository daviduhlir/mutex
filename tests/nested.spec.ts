import { assert, expect } from 'chai'
import { Mutex } from '../dist'
import { delay, RWSimulator } from './utils'

/**
 * Locks with nested keys test
 */
describe('Nested locks', function() {
  it('Simple test #1', async function() {
    let marker = ''

    await Mutex.lockSingleAccess('root', async () => {
      marker += 'A'
      await delay(10)
      await Mutex.lockSingleAccess('root', async () => {
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
      Mutex.lockSingleAccess('root', async () => {
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

    await Mutex.lockSingleAccess('root', async () => {
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

  it('Keep locked after exit nested #1', async function() {
    let marker = ''
    await Mutex.lockSingleAccess('root', async () => {
      marker += 'A'

      Mutex.lockSingleAccess('root', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await Mutex.lockSingleAccess('root', async () => {
      marker += 'E'
      await delay(110)
      marker += 'F'
    })

    expect(marker).to.equal('ABDCEF')
  })

  it('Keep locked after exit nested #2 (with nested keys)', async function() {
    let marker = ''
    await Mutex.lockSingleAccess('root/index', async () => {
      marker += 'A'

      Mutex.lockSingleAccess('root/try', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await Mutex.lockSingleAccess('root/index', async () => {
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
      Mutex.lockMultiAccess('root', async () => {
        marker += 'A'

        await delay(10)

        await Mutex.lockSingleAccess('root', async () => {
          marker += 'B'
          await delay(10)
          marker += 'C'
        })

        await delay(15)

        marker += 'D'
      }),
      delay(15, () => Mutex.lockMultiAccess('root', async () => {
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
      Mutex.lockSingleAccess('slave', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
      Mutex.lockSingleAccess('master', async () => {
        marker += 'A'
        await Mutex.lockSingleAccess('slave', async () => {
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
      Mutex.lockSingleAccess('master', async () => {
        await delay(10)
        marker += 'A'
        await Mutex.lockSingleAccess('master', async () => {
          marker += 'B'
          await delay(20)
          marker += 'C'
        })
        marker += 'D'
      }),
      Mutex.lockSingleAccess('master', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
    ])

    expect(marker).to.equal('ABCDEF')
  })

  it('Nested parallel', async function() {
    let marker = ''
    await Mutex.lockSingleAccess('root', async () => {
      marker += 'A:IN;'
      await Promise.all([
        Mutex.lockSingleAccess('root/test', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        Mutex.lockSingleAccess('root/test', async () => {
          marker += 'C:IN;'
          await delay(10)
          marker += 'C:OUT;'
        })
      ])
      marker += 'A:OUT;'
    })
    expect(marker).to.equal('A:IN;B:IN;B:OUT;C:IN;C:OUT;A:OUT;')
  })

  it('Nested parallel oposit way', async function() {
    let marker = ''
    await Mutex.lockSingleAccess('root/test', async () => {
      marker += 'A:IN;'
      await Promise.all([
        Mutex.lockSingleAccess('root', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        Mutex.lockSingleAccess('root', async () => {
          marker += 'C:IN;'
          await delay(10)
          marker += 'C:OUT;'
        })
      ])
      marker += 'A:OUT;'
    })
    expect(marker).to.equal('A:IN;B:IN;B:OUT;C:IN;C:OUT;A:OUT;')
  })

  it('Nested parallel multi access together', async function() {
    let marker = ''

    await Promise.all([
      Mutex.lockMultiAccess('root', async () => {
        marker += 'A:IN;'
        await Promise.all([
          Mutex.lockSingleAccess('root/test', async () => {
            marker += 'C:IN;'
            await delay(10)
            marker += 'C:OUT;'
          }),
          Mutex.lockSingleAccess('root/test', async () => {
            marker += 'B:IN;'
            await delay(20)
            marker += 'B:OUT;'
          }),
        ])
        marker += 'A:OUT;'
      }),
      Mutex.lockMultiAccess('root/test', async () => {
        marker += 'D:IN;'
          await delay(20)
        marker += 'D:OUT;'
      }),
    ])


    expect(marker).to.equal('A:IN;D:IN;D:OUT;C:IN;C:OUT;B:IN;B:OUT;A:OUT;')
  })

  it('Break stack to lose context', async function() {

    function wrap(caller) {
      return Mutex.lockSingleAccess('root', caller)
    }

    async function m(resolve) {
      await Mutex.lockMultiAccess('root', async () => 'Hello')
      resolve()
    }

    await new Promise(async (resolve) => {
      await wrap(async () => {

        await new Promise(async (resolve) => {
          setTimeout(() => m(resolve), 1)
          await delay(100)
        })

        resolve(null)
      })
    })
  })

  /*it('Skip wait after timeout', async function() {

    await Mutex.initialize({
      continueOnTimeout: true
    })

    let timeoutedItem
    const originalHandler = SharedMutexSynchronizer.timeoutHandler
    SharedMutexSynchronizer.timeoutHandler = (hash: string) => {
      timeoutedItem = SharedMutexSynchronizer.getLockInfo(hash)
    }

    try {
      await Promise.all([
        setTimeout(() => Mutex.lockSingleAccess('root', async () => {
          await delay(10)
        }, 1000), 100),
        Mutex.lockSingleAccess('root', async () => {
          await new Promise((resolve) => 0)
        }, 2000),
      ])
    } catch(e) {
      // Error expected
    }

    SharedMutexSynchronizer.timeoutHandler = originalHandler

    expect(timeoutedItem.key).to.equal('/root')

    await Mutex.initialize({
      continueOnTimeout: false
    })

  })*/
})
