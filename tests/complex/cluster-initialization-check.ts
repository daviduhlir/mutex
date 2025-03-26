
import cluster from 'cluster'
import { delay } from '../utils'

;(async function () {
  if (!cluster.isWorker) {
    cluster.fork()
      .on('exit', (e) => {
        if (e !== 0) {
          throw new Error('Cluster failed: ' + e.toString())
        }
      })
  } else {
    const { SharedMutex } = require('../../dist')
    SharedMutex.setOptions({
      awaitInitTimeout: 1000,
    })
    await SharedMutex.lockSingleAccess('mutex', async () => {
      console.log(`S:L`)
      await delay(1000)
      console.log(`S:U`)
    })
    process.exit(0)
  }
})()
