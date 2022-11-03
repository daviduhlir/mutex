import { SharedMutex } from '../../dist'
import cluster from 'cluster'
import { delay } from '../utils'

;(async function () {
  if (cluster.isPrimary) {
    for(let index = 0; index < 5; index++) {
      cluster.fork({ index })
        .on('exit', (e) => {
          if (e !== 0) {
            throw new Error('Cluster failed: ' + e.toString())
          }
        })
      await delay(1)
    }
  } else {
    const index = parseInt(process.env['index'] as any, 10)

    if (index === 0) {
      await SharedMutex.lockSingleAccess('mutex', async () => {
        console.log(`S:L`)
        await delay(5)
        console.log(`S:U`)
      })
      process.exit(0)
    } else {
      await SharedMutex.lockMultiAccess('mutex', async () => {
        console.log(`M:L`)
        await delay(50)
        console.log(`M:U`)
      })
      process.exit(0)
    }
  }
})()
