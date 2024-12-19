import { MutexExecutor } from './components/MutexExecutor'
import { SharedMutexSynchronizer } from './components/SharedMutexSynchronizer'

export const SharedMutex = new MutexExecutor(new SharedMutexSynchronizer())
