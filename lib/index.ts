import cluster from './utils/cluster'
import { SharedMutex } from './SharedMutex'
export * from './SharedMutex'
export * from './SharedMutexDecorators'
export * from './SecondarySynchronizer'
export * from './SharedMutexSynchronizer'
export * from './DebugGuard'

if (cluster.isMaster) {
  SharedMutex.initialize()
}
