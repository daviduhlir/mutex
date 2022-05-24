import { SharedMutex } from '@david.uhlir/mutex';

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

(async function() {
  console.log('----Running single access test----\n')

  await Promise.all([
    SharedMutex.lockSingleAccess('mutex', async () => {
        console.log('Lock single test 1')
        await delay(1000)
        console.log('Unlock single test 1')
    }),
    SharedMutex.lockSingleAccess('mutex', async () => {
        console.log('Lock single test 2')
        await delay(1000)
        console.log('Unlock single test 2')
    })
  ])

  console.log('\n----Running multi access test----\n')

  await Promise.all([
    SharedMutex.lockMultiAccess('mutex', async () => {
        console.log('Lock multi test 1')
        await delay(1000)
        console.log('Unlock multi test 1')
    }),
    SharedMutex.lockMultiAccess('mutex', async () => {
        console.log('Lock multi test 2')
        await delay(1000)
        console.log('Unlock multi test 2')
    }),
    SharedMutex.lockSingleAccess('mutex', async () => {
      console.log('Lock single test 2')
      await delay(1000)
      console.log('Unlock single test 2')
  })
  ])
})()


