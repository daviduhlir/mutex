import cluster from './utils/clutser'
import { SharedMutexSynchronizer } from './SharedMutexSynchronizer'
export * from './SharedMutex'
export * from './SharedMutexDecorators'
export * from './SecondarySynchronizer'

if (cluster.isMaster) {
  SharedMutexSynchronizer.initializeMaster()
}
