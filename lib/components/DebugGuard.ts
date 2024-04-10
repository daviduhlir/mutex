import { DEBUG_INFO_REPORTS } from '../utils/constants'
import { LocalLockItem } from '../utils/interfaces'
import { keysRelatedMatch } from '../utils/utils'

const LOG_PREFIX = `MUTEX_DEBUG`

export interface StateInfo {
  opened: boolean
  key: string
  waitingFirstTick: boolean
  firstAttempTime?: number
  enteredTime?: number
}

export class DebugGuard {
  static writeFunction: (...msgs: any[]) => void = console.log

  protected static currentStates: {
    [hash: string]: StateInfo
  } = {}

  static reportDebugInfo(state: string, item: LocalLockItem, codeStack?: string) {
    if (state === DEBUG_INFO_REPORTS.SCOPE_WAITING) {
      if (!DebugGuard.currentStates[item.hash]) {
        DebugGuard.currentStates[item.hash] = {
          key: item.key,
          opened: false,
          waitingFirstTick: true,
          firstAttempTime: Date.now(),
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
            codeStack ? `\n${codeStack}` : undefined,
          )
        } else {
          DebugGuard.currentStates[item.hash].enteredTime = Date.now()
          DebugGuard.writeFunction(LOG_PREFIX, item.key, `Entering scope`)
        }

        DebugGuard.currentStates[item.hash].waitingFirstTick = false
      })
    } else if (state === DEBUG_INFO_REPORTS.SCOPE_CONTINUE) {
      if (DebugGuard.currentStates[item.hash]) {
        if (!DebugGuard.currentStates[item.hash].waitingFirstTick) {
          let waitingTime
          if (DebugGuard.currentStates[item.hash]) {
            waitingTime = Date.now() - DebugGuard.currentStates[item.hash].firstAttempTime
            DebugGuard.currentStates[item.hash].enteredTime = Date.now()
          }
          DebugGuard.writeFunction(LOG_PREFIX, item.key, `Continue into scope` + (waitingTime ? ` (Blocked for ${waitingTime}ms)` : ''))
        }
        DebugGuard.currentStates[item.hash].opened = true
      }
    } else if (state === DEBUG_INFO_REPORTS.SCOPE_EXIT) {
      if (DebugGuard.currentStates[item.hash]) {
        const lockedTime = Date.now() - DebugGuard.currentStates[item.hash].enteredTime
        DebugGuard.writeFunction(LOG_PREFIX, item.key, `Leaving scope` + (lockedTime ? ` (Locked for ${lockedTime}ms)` : ''))
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
