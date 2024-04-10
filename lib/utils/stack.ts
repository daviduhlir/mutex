import { SharedMutexSynchronizer } from '../components/SharedMutexSynchronizer'

export function getStackFrom(getFrom: string) {
  if (!SharedMutexSynchronizer.debugWithStack) {
    return null
  }

  let codeStack
  const e = new Error()
  codeStack = e.stack

  const stackLines = codeStack.split('\n')
  const found = stackLines.findIndex(line => line.trim().includes(`${getFrom}`))
  return found !== -1 ? stackLines.slice(found + 1).join('\n') : null
}
