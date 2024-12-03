import { assert, expect } from 'chai'
import { SharedMutex, SharedMutexSynchronizer } from '../dist'
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

        await delay(15)

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

  it('Nested parallel', async function() {
    let marker = ''
    await SharedMutex.lockSingleAccess('root', async () => {
      marker += 'A:IN;'
      await Promise.all([
        SharedMutex.lockSingleAccess('root/test', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        SharedMutex.lockSingleAccess('root/test', async () => {
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
    await SharedMutex.lockSingleAccess('root/test', async () => {
      marker += 'A:IN;'
      await Promise.all([
        SharedMutex.lockSingleAccess('root', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        SharedMutex.lockSingleAccess('root', async () => {
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
      SharedMutex.lockMultiAccess('root', async () => {
        marker += 'A:IN;'
        await Promise.all([
          SharedMutex.lockSingleAccess('root/test', async () => {
            marker += 'C:IN;'
            await delay(10)
            marker += 'C:OUT;'
          }),
          SharedMutex.lockSingleAccess('root/test', async () => {
            marker += 'B:IN;'
            await delay(20)
            marker += 'B:OUT;'
          }),
        ])
        marker += 'A:OUT;'
      }),
      SharedMutex.lockMultiAccess('root/test', async () => {
        marker += 'D:IN;'
          await delay(20)
        marker += 'D:OUT;'
      }),
    ])


    expect(marker).to.equal('A:IN;D:IN;D:OUT;C:IN;C:OUT;B:IN;B:OUT;A:OUT;')
  })

  it('Break stack to lose context', async function() {

    function wrap(caller) {
      return SharedMutex.lockSingleAccess('root', caller)
    }

    async function m(resolve) {
      await SharedMutex.lockMultiAccess('root', async () => 'Hello')
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

  it('Dead end detection', async function() {

    async function tt() {
      let marker = ''
      await SharedMutex.lockMultiAccess('root', async () => {
        marker += 'A'
        //await delay(10)
        await SharedMutex.lockSingleAccess('root', async () => {
          marker += 'B'
          await delay(10)
          marker += 'C'
        })
        marker += 'D'
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

  it('Skip wait after timeout', async function() {

    await SharedMutex.initialize({
      continueOnTimeout: true
    })

    let timeoutedItem
    const originalHandler = SharedMutexSynchronizer.timeoutHandler
    SharedMutexSynchronizer.timeoutHandler = (hash: string) => {
      timeoutedItem = SharedMutexSynchronizer.getLockInfo(hash)
    }

    try {
      await Promise.all([
        setTimeout(() => SharedMutex.lockSingleAccess('root', async () => {
          await delay(10)
        }, 1000), 100),
        SharedMutex.lockSingleAccess('root', async () => {
          await new Promise((resolve) => 0)
        }, 2000),
      ])
    } catch(e) {
      // Error expected
    }

    SharedMutexSynchronizer.timeoutHandler = originalHandler

    expect(timeoutedItem.key).to.equal('/root')
    expect(timeoutedItem.isRunning).to.equal(true)

    await SharedMutex.initialize({
      continueOnTimeout: false
    })

  })
})
