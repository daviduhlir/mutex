import { assert, expect } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { delay, RWSimulator } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Locks with nested keys test
 */
describe(`Nested locks (${process.env.class})`, function() {
  it('Simple test #1', async function() {
    let marker = ''

    await TestedMutex.lockSingleAccess('root', async () => {
      marker += 'A'
      await delay(10)
      await TestedMutex.lockSingleAccess('root', async () => {
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
      TestedMutex.lockSingleAccess('root', async () => {
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

    await TestedMutex.lockSingleAccess('root', async () => {
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
    await TestedMutex.lockSingleAccess('root', async () => {
      marker += 'A'

      TestedMutex.lockSingleAccess('root', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await TestedMutex.lockSingleAccess('root', async () => {
      marker += 'E'
      await delay(110)
      marker += 'F'
    })

    expect(marker).to.equal('ABDCEF')
  })

  it('Keep locked after exit nested #2 (with nested keys)', async function() {
    let marker = ''
    await TestedMutex.lockSingleAccess('root/index', async () => {
      marker += 'A'

      TestedMutex.lockSingleAccess('root/try', async () => {
        marker += 'B'
        await delay(100)
        marker += 'C'
      })

      await delay(10)
      marker += 'D'
    })

    await TestedMutex.lockSingleAccess('root/index', async () => {
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
      TestedMutex.lockMultiAccess('root', async () => {
        marker += 'A'

        await delay(10)

        await TestedMutex.lockSingleAccess('root', async () => {
          marker += 'B'
          await delay(10)
          marker += 'C'
        })

        await delay(15)

        marker += 'D'
      }),
      delay(15, () => TestedMutex.lockMultiAccess('root', async () => {
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
      TestedMutex.lockSingleAccess('slave', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
      TestedMutex.lockSingleAccess('master', async () => {
        marker += 'A'
        await TestedMutex.lockSingleAccess('slave', async () => {
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
      TestedMutex.lockSingleAccess('master', async () => {
        await delay(10)
        marker += 'A'
        await TestedMutex.lockSingleAccess('master', async () => {
          marker += 'B'
          await delay(20)
          marker += 'C'
        })
        marker += 'D'
      }),
      TestedMutex.lockSingleAccess('master', async () => {
        marker += 'E'
        await delay(20)
        marker += 'F'
      }),
    ])

    expect(marker).to.equal('ABCDEF')
  })

  it('Nested parallel', async function() {
    let marker = ''
    await TestedMutex.lockSingleAccess('root', async () => {
      marker += 'A:IN;'
      await Promise.all([
        TestedMutex.lockSingleAccess('root/test', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        TestedMutex.lockSingleAccess('root/test', async () => {
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
    await TestedMutex.lockSingleAccess('root/test', async () => {
      marker += 'A:IN;'
      await Promise.all([
        TestedMutex.lockSingleAccess('root', async () => {
          marker += 'B:IN;'
          await delay(20)
          marker += 'B:OUT;'
        }),
        TestedMutex.lockSingleAccess('root', async () => {
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
      TestedMutex.lockMultiAccess('root', async () => {
        marker += 'A:IN;'
        await Promise.all([
          TestedMutex.lockSingleAccess('root/test', async () => {
            marker += 'C:IN;'
            await delay(10)
            marker += 'C:OUT;'
          }),
          TestedMutex.lockSingleAccess('root/test', async () => {
            marker += 'B:IN;'
            await delay(20)
            marker += 'B:OUT;'
          }),
        ])
        marker += 'A:OUT;'
      }),
      TestedMutex.lockMultiAccess('root/test', async () => {
        marker += 'D:IN;'
          await delay(20)
        marker += 'D:OUT;'
      }),
    ])


    expect(marker).to.equal('A:IN;D:IN;D:OUT;C:IN;C:OUT;B:IN;B:OUT;A:OUT;')
  })

  it('Break stack to lose context', async function() {

    function wrap(caller) {
      return TestedMutex.lockSingleAccess('root', caller)
    }

    async function m(resolve) {
      await TestedMutex.lockMultiAccess('root', async () => 'Hello')
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

  it('Skip wait after timeout #1', async function() {

    let timeoutedItem
    TestedMutex.setOptions({
      continueOnTimeout: true,
      timeoutHandler: (item) => {
        timeoutedItem = item
      }
    })

    try {
      await Promise.all([
        setTimeout(() => TestedMutex.lockSingleAccess('root', async () => {
          await delay(10)
        }, 1000), 100),
        TestedMutex.lockSingleAccess('root', async () => {
          await new Promise((resolve) => 0)
        }, 2000),
      ])
    } catch(e) {
      // Error expected
    }

    TestedMutex.setOptions({
      timeoutHandler: undefined
    })

    expect(timeoutedItem.key).to.equal('/root')

  })

  it('Skip wait after timeout #2', async function() {

    let timeoutedItem
    let errScopeA
    let errScopeB
    TestedMutex.setOptions({
      continueOnTimeout: true,
      timeoutHandler: (item) => {
        timeoutedItem = item
      }
    })

    let time = Date.now()
    try {
      await TestedMutex.lockSingleAccess('root', async () => {
        await delay(1000)
      }, 10)
    } catch(e) {
      errScopeA = e
    }
    const timeDeltaA = Date.now() - time
    time = Date.now()
    try {
      await TestedMutex.lockSingleAccess('root', async () => {
        await delay(10)
      }, 1000)
    } catch(e) {
      errScopeB = e
    }
    const timeDeltaB = Date.now() - time

    TestedMutex.setOptions({
      timeoutHandler: undefined
    })

    assert(timeDeltaA >= 10 && timeDeltaA < 50, `Time of scope A should be ~10ms`)
    assert(timeDeltaB >= 10 && timeDeltaB < 50, `Time of scope B should be ~10ms`)
    expect(errScopeA.key).to.equal('MUTEX_LOCK_TIMEOUT')
    expect(errScopeB).to.equal(undefined)
    expect(timeoutedItem.key).to.equal('/root')
    expect(TestedMutex.synchronizer.isClear()).to.equal(true)
  })
})
