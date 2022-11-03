import cluster from './utils/cluster'
import { SharedMutexSynchronizer } from './SharedMutexSynchronizer'
export * from './SharedMutex'
export * from './SharedMutexDecorators'
export * from './SecondarySynchronizer'

if (cluster.isPrimary) {
  SharedMutexSynchronizer.initializeMaster()
}
