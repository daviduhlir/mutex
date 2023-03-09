import { SharedMutex } from '../../dist'
import cluster from 'cluster'
import { delay } from '../utils'

;(async function () {
  if (cluster.isMaster) {
    SharedMutex.initialize()
    for(let index = 0; index < 4; index++) {
      await delay(5)
      cluster.fork({ index })
        .on('exit', (e) => {
          if (e !== 0) {
            throw new Error('Cluster failed: ' + e.toString())
          }
        })
    }
  } else {
    await SharedMutex.lockSingleAccess('mutex', async () => {
      console.log(`S:L`)
      await delay(10)
      console.log(`S:U`)
    })
    process.exit(0)
  }
})()
