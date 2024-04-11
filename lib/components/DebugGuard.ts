import { DEBUG_INFO_REPORTS } from '../utils/constants'
import { LocalLockItem } from '../utils/interfaces'
import { keysRelatedMatch } from '../utils/utils'

const LOG_PREFIX = `MUTEX_DEBUG`

export interface StateInfo {
  opened: boolean
  key: string
  hash: string
  singleAccess: boolean
  waitingFirstTick: boolean
  firstAttempTime?: number
  enteredTime?: number
  wasBlockedBy?: string[]
  enterStack?: string
}

export interface DebugGuardOptions {
  logEnterScope: boolean
  logWaitingOutside: boolean
  logContinue: boolean
  logLeave: boolean
  logDetail: boolean
  logContinueMinTime: number
  logLeaveMinTime: number
}

export class DebugGuard {
  static options: DebugGuardOptions = {
    logEnterScope: true,
    logWaitingOutside: true,
    logContinue: true,
    logLeave: true,
    logDetail: false,
    logContinueMinTime: 0,
    logLeaveMinTime: 0,
  }

  static writeFunction: (...msgs: any[]) => void = console.log

  protected static currentStates: {
    [hash: string]: StateInfo
  } = {}

  static reportDebugInfo(state: string, item: LocalLockItem, codeStack?: string) {
    if (state === DEBUG_INFO_REPORTS.SCOPE_WAITING) {
      if (!DebugGuard.currentStates[item.hash]) {
        DebugGuard.currentStates[item.hash] = {
          key: item.key,
          hash: item.hash,
          singleAccess: item.singleAccess,
          opened: false,
          waitingFirstTick: true,
          firstAttempTime: Date.now(),
        }
      }
      DebugGuard.currentStates[item.hash].enterStack = codeStack

      setImmediate(() => {
        if (!DebugGuard.currentStates[item.hash]?.opened) {
          const allRelated = DebugGuard.getAllRelated(item.key, item.hash)

          if (DebugGuard.currentStates[item.hash]) {
            DebugGuard.currentStates[item.hash].wasBlockedBy = allRelated.map(i => i.key)
          }

          if (DebugGuard.options.logWaitingOutside) {
            const blockedByCount = DebugGuard.currentStates[item.hash]?.wasBlockedBy?.length || 0
            const blockedBy = DebugGuard.currentStates[item.hash]?.wasBlockedBy?.filter?.((value, index, array) => array.indexOf(value) === index)?.join?.(', ')

            DebugGuard.writeFunction(
              LOG_PREFIX,
              item.key + (item.singleAccess ? ' (S)' : ' (M)'),
              `Waiting outside of scope. Posible blockers: `,
              `${blockedBy} ${blockedByCount}x`,
              DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                : undefined,
            )
          }
        } else {
          DebugGuard.currentStates[item.hash].wasBlockedBy = []
          DebugGuard.currentStates[item.hash].enteredTime = Date.now()
          if (DebugGuard.options.logEnterScope) {
            DebugGuard.writeFunction(LOG_PREFIX, item.key + (item.singleAccess ? ' (S)' : ' (M)'), `Entering scope`)
          }
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
          if (DebugGuard.options.logContinue && waitingTime >= DebugGuard.options.logContinueMinTime) {
            const blockedByCount = DebugGuard.currentStates[item.hash]?.wasBlockedBy?.length || 0
            const blockedBy = DebugGuard.currentStates[item.hash]?.wasBlockedBy?.filter?.((value, index, array) => array.indexOf(value) === index)?.join?.(', ')
            DebugGuard.writeFunction(
              LOG_PREFIX,
              item.key + (item.singleAccess ? ' (S)' : ' (M)'),
              `Continue into scope (Blocked for ${waitingTime}ms by ${blockedBy} ${blockedByCount}x)`,
              DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
                ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
                : undefined,
            )
          }
        }
        DebugGuard.currentStates[item.hash].opened = true
      }
    } else if (state === DEBUG_INFO_REPORTS.SCOPE_EXIT) {
      if (DebugGuard.currentStates[item.hash]) {
        const lockedTime = Date.now() - DebugGuard.currentStates[item.hash].enteredTime
        if (DebugGuard.options.logLeave && lockedTime >= DebugGuard.options.logLeaveMinTime) {
          DebugGuard.writeFunction(
            LOG_PREFIX,
            item.key + (item.singleAccess ? ' (S)' : ' (M)'),
            `Leaving scope (Locked for ${lockedTime}ms)`,
            DebugGuard.currentStates[item.hash].enterStack && DebugGuard.options.logDetail
              ? `\n${DebugGuard.currentStates[item.hash].enterStack}`
              : undefined,
          )
        }
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
