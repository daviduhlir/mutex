import { MutexExecutor } from './components/MutexExecutor'
import { MutexSynchronizer } from './components/MutexSynchronizer'

export * from './components/MutexExecutor'
export * from './components/SharedMutexDecorators'
export * from './components/MutexSynchronizer'
export * from './utils/interfaces'
export * from './utils/Awaiter'
export { prettyPrintError } from './utils/utils'

export const Mutex = new MutexExecutor(new MutexSynchronizer())
