import { LocalLockItem } from './utils/interfaces'
import { keysRelatedMatch } from './utils/utils'
import { DEBUG_INFO_REPORTS } from './SharedMutexSynchronizer'

const LOG_PREFIX = `MUTEX_DEBUG`

export interface StateInfo {
  opened: boolean
  key: string
  waitingFirstTick: boolean
}

export class DebugGuard {
  static writeFunction: (...msgs: any[]) => void = console.log

  protected static currentStates: {
    [hash: string]: StateInfo
  } = {}

  static reportDebugInfo(state: string, item: LocalLockItem) {
    if (state === DEBUG_INFO_REPORTS.SCOPE_WAITING) {
      if (!DebugGuard.currentStates[item.hash]) {
        DebugGuard.currentStates[item.hash] = {
          key: item.key,
          opened: false,
          waitingFirstTick: true,
        }
      }

      setImmediate(() => {
        if (!DebugGuard.currentStates[item.hash]?.opened) {
          const allRelated = DebugGuard.getAllRelated(item.key, item.hash)
          DebugGuard.writeFunction(
            LOG_PREFIX,
            item.key,
            `Waiting outside of scope. Posible blockers: `,
            allRelated.map(i => i.key),
          )
        } else {
          DebugGuard.writeFunction(LOG_PREFIX, item.key, `Entering scope`)
        }

        DebugGuard.currentStates[item.hash].waitingFirstTick = false
      })
    } else if (state === DEBUG_INFO_REPORTS.SCOPE_CONTINUE) {
      if (DebugGuard.currentStates[item.hash]) {
        if (!DebugGuard.currentStates[item.hash].waitingFirstTick) {
          DebugGuard.writeFunction(LOG_PREFIX, item.key, `Continue into scope`)
        }
        DebugGuard.currentStates[item.hash].opened = true
      }
    } else if (state === DEBUG_INFO_REPORTS.SCOPE_EXIT) {
      if (DebugGuard.currentStates[item.hash]) {
        DebugGuard.writeFunction(LOG_PREFIX, item.key, `Leaving scope`)
        delete DebugGuard.currentStates[item.hash]
      }
    }
  }

  protected static getAllRelated(lookupKey, originHash?: string) {
    return Object.keys(DebugGuard.currentStates).reduce<StateInfo[]>((acc, hash) => {
      const item = DebugGuard.currentStates[hash]
      if (keysRelatedMatch(lookupKey, item.key) && hash !== originHash) {
        return [...acc, DebugGuard.currentStates[hash]]
      }
      return acc
    }, [])
  }
}
