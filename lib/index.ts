import cluster from './clutser'
import { SharedMutexSynchronizer } from './SharedMutex'
export * from './SharedMutex'

if (cluster.isMaster) {
    SharedMutexSynchronizer.initializeMaster()
}
