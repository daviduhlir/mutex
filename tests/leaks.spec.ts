import { assert, expect } from 'chai'
import { Mutex, SharedMutex } from '../dist'
import { delay } from './utils'

let TestedMutex = process.env.class === 'Mutex' ? Mutex : SharedMutex

/**
 * Simple locks test
 */
describe(`Leaks test (${process.env.class})`, function() {

  it('Test scopes and count whats left', async function() {
    const before = TestedMutex.synchronizer.isClear()

    await Promise.all(
      new Array(2).fill(null).map(() =>
        TestedMutex.lockSingleAccess('mutex/deep', async () => {
          await delay(10)
        }),
      )
    .concat(
      new Array(2).fill(null).map(() =>
        TestedMutex.lockMultiAccess('mutex', async () => {
          await delay(10)
        }),
      )
    ))

    const after = TestedMutex.synchronizer.isClear()

    assert(before === after && before === true, 'Locks count before and after test should be 0')
    expect(TestedMutex.synchronizer.isClear()).to.equal(true)
  })

})
