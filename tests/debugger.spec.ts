import { expect } from 'chai'
import { Mutex, MutexExecutor, SharedMutex } from '../dist'
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

  after(function() {
    TestedMutex.setOptions({})
  })

  it('Dead end detection', async function() {
    async function tt() {
      try {
        await TestedMutex.lockMultiAccess('root', async () => {
          await TestedMutex.lockSingleAccess('root', async () => {
            await delay(10)
          })
        })
      } catch(e) {
        err = e
      }
    }

    let err
    await Promise.all([
      tt(),
      tt(),
    ])
    expect(err?.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
  })

  it('Dead end detection #2', async function() {
    let err
      await Promise.all([
        (async () => {
          try {
            TestedMutex.lockMultiAccess('root', async () => {
              await TestedMutex.lockMultiAccess('root', async () => {
                await TestedMutex.lockSingleAccess('root', async () => {
                  await delay(100)
                })
              })
            })
          } catch(e) {
            err = e
          }
        })(),
        (async () => {
          try {
            TestedMutex.lockMultiAccess('root', async () => {
              await TestedMutex.lockSingleAccess('root', async () => {
                await delay(10)
              })
            })
          } catch(e) {
            err = e
          }
        })()
      ])
    expect(err?.message).to.equal(undefined)
  })

  it('Dead end detection #3', async function() {
    let err
      await Promise.all([
        (async () => {
          try {
            await TestedMutex.lockSingleAccess('A', async () => {
              await TestedMutex.lockMultiAccess('B', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            err = e
          }
        })(),
        (async () => {
          try {
            await TestedMutex.lockSingleAccess('B', async () => {
              await TestedMutex.lockMultiAccess('A', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            err = e
          }
        })()
      ])
    expect(err?.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
  })

  it('Dead end detection #4', async function() {
    let e0, e1, e2
    try {
      await Promise.all([
        (async () => {
          try {
            await TestedMutex.lockMultiAccess('A', async () => {
              await TestedMutex.lockSingleAccess('B', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            e1 = e
          }
        })(),
        (async () => {
          try {
            await TestedMutex.lockMultiAccess('B', async () => {
              await TestedMutex.lockSingleAccess('A', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            e2 = e
          }
        })()
      ])
    } catch(e) {
      e0 = e
    }

    expect((e0 || e1 || e2).message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
  })


  it('Dead end detection #5', async function() {
    let err
    await Promise.all([
      (async () => {
        try {
          await TestedMutex.lockSingleAccess(['A', 'B'], async () => {
            await delay(100)
          })
        } catch(e) {
          err = e
        }
      })(),
      (async () => {
        try {
          await TestedMutex.lockSingleAccess(['B', 'A'], async () => {
            await delay(100)
          })
        } catch(e) {
          err = e
        }
      })()
    ])
    expect(err?.message).to.equal(undefined)
  })

  it('Dead end detection #6', async function() {
    let err
      await Promise.all([
        (async () => {
          try {
            await TestedMutex.lockSingleAccess('A', async () => {
              await TestedMutex.lockSingleAccess('B', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            err = e
          }
        })(),
        (async () => {
          try {
            await TestedMutex.lockSingleAccess('B', async () => {
              await TestedMutex.lockSingleAccess('A', async () => {
                await delay(100)
              })
            })
          } catch(e) {
            err = e
          }
        })()
      ])
    expect(err?.message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')
  })

  if (TestedMutex === SharedMutex) {
    it('Dead end detection #7 (Combined Mutex and SharedMutex)', async function() {
      Mutex.setOptions({
        debugDeadEnds: true
      })
      SharedMutex.setOptions({
        debugDeadEnds: true
      })

      let e0, e1, e2

      try {
        await Promise.all([
          (async () => {
            try {
              await SharedMutex.lockMultiAccess('A', async () => {
                await Mutex.lockSingleAccess('B', async () => {
                  await delay(100)
                })
              })
            } catch(e) {
              e1 = e
            }
          })(),
          (async () => {
            try {
              await Mutex.lockMultiAccess('B', async () => {
                await SharedMutex.lockSingleAccess('A', async () => {
                  await delay(100)
                })
              })
            } catch(e) {
              e2 = e
            }
          })()
        ])
      } catch(e) {
        e0 = e
      }

      expect((e0 || e1 || e2).message).to.equal('MUTEX_NOTIFIED_EXCEPTION: Dead end detected, this combination will never be unlocked. See the documentation.')

      Mutex.setOptions({})
      SharedMutex.setOptions({})
    })
  }
})
