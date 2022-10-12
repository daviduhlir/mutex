import { expect, assert } from 'chai'
import { SharedMutex } from '../dist'

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

describe('lock test', function() {
  it('single access', async function() {

    let locked = false

    await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        assert.equal(locked, false, 'should not be locked')
        console.log('Lock single test 1')
        locked = true
        await delay(10)
        console.log('Unlock single test 1')
        locked = false
      }),
      SharedMutex.lockSingleAccess('mutex', async () => {
        assert.equal(locked, false, 'should not be locked')
        console.log('Lock single test 2')
        locked = true
        await delay(10)
        console.log('Unlock single test 2')
        locked = false
      }),
    ])

  })

  it('multi access', async function() {
    let lockedWrite = false
    let lockedRead = false

    await Promise.all([
      Promise.all([
        SharedMutex.lockMultiAccess('mutex', async () => {
          assert.equal(lockedRead, false, 'should not be locked for read')
          console.log('Lock multi test 1')
          lockedWrite = true
          await delay(10)
          console.log('Unlock multi test 1')
          lockedWrite = false
        }),
        SharedMutex.lockMultiAccess('mutex', async () => {
          assert.equal(lockedRead, false, 'should not be locked for read')
          console.log('Lock multi test 2')
          lockedWrite = true
          await delay(10)
          console.log('Unlock multi test 2')
          lockedWrite = false
        }),
      ]),
      delay(1).then(() => SharedMutex.lockSingleAccess('mutex', async () => {
        assert.equal(lockedRead, false, 'should not be locked for read')
        assert.equal(lockedWrite, false, 'should not be locked for write')
        console.log('Lock single test')
        lockedWrite = true
        lockedRead = true
        await delay(10)
        console.log('Unlock single test')
        lockedWrite = false
        lockedRead = true
      })),
    ])

  })
})
