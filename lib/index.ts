import cluster from './utils/cluster'
import { SharedMutexSynchronizer } from './SharedMutexSynchronizer'
export * from './SharedMutex'
export * from './SharedMutexDecorators'
export * from './SecondarySynchronizer'
export * from './SharedMutexSynchronizer'
export * from './DebugGuard'
export { MutexSafeCallbackHandler } from './components/MutexSafeCallbackHandler'

export * from './utils/interfaces'

if (cluster.isMaster) {
  SharedMutexSynchronizer.initializeMaster()
}
