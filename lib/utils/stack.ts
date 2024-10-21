import { SharedMutexSynchronizer } from '../components/SharedMutexSynchronizer'

export function getStackFrom() {
  if (!SharedMutexSynchronizer.debugWithStack) {
    return null
  }

  const e = new Error()
  return e.stack
}
