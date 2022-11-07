import cluster from './utils/cluster'
import { SharedMutexSynchronizer } from './SharedMutexSynchronizer'
export * from './SharedMutex'
export * from './SharedMutexDecorators'
export * from './SecondarySynchronizer'
export * from './SharedMutexSynchronizer'

if (cluster.isMaster) {
  SharedMutexSynchronizer.initializeMaster()
}
