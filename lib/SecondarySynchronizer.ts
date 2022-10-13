import { LocalLockItem } from './utils/interfaces'
import { EventEmitter } from 'events'

export const SYNC_EVENTS = {
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  CONTINUE: 'CONTINUE',
}
export class SecondarySynchronizer extends EventEmitter {
  public lock(item: LocalLockItem) {}

  public unlock(hash: string) {}

  public continue(item: LocalLockItem) {}

  public get isArbitter(): boolean {
    return true
  }
}
