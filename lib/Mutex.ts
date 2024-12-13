import { LocalMutexSynchronizer } from './components/LocalMutexSynchronizer'
import { MutexExecutor } from './components/MutexExecutor'

export const Mutex = new MutexExecutor(new LocalMutexSynchronizer())
