import { SharedMutex } from '../../dist'
import cluster from 'cluster'
import { delay } from '../utils'

;(async function () {
  if (!cluster.isWorker) {

    await Promise.all([
      (async () => {
        for(let index = 0; index < 5; index++) {
          cluster.fork({ index })
            .on('exit', (e) => {
              if (e !== 0) {
                throw new Error('Cluster failed: ' + e.toString())
              }
            })
        }
      })(),
      ...new Array(50).fill(null).map(() =>
        SharedMutex.lockSingleAccess('root', async () => {
          console.log(`S:L`)
          await delay(1)
          console.log(`S:U`)
        })),
    ])
    await delay(1000)
    process.exit(0)
  } else {
    await Promise.all(new Array(50).fill(null).map(() =>
      SharedMutex.lockSingleAccess('root', async () => {
        console.log(`S:L`)
        await delay(1)
        console.log(`S:U`)
      })))
    await delay(1000)
    process.exit(0)
  }
})()
