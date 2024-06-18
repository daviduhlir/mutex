export class RWSimulator {
  protected lockedWrite: boolean = false
  protected lockedRead: boolean[] = []

  public read(): {stop: () => void} {
    if (this.isLockedForWrite()) {
      throw new Error('Already locked for write.')
    }
    const index = this.lockedRead.length
    this.lockedRead.push(true)
    return { stop: () => this.lockedRead[index] = false }
  }

  public write(): {stop: () => void} {
    if (this.isLockedForRead()) {
      throw new Error('Already locked for read.')
    }
    if (this.isLockedForWrite()) {
      throw new Error('Already locked for write.')
    }
    this.lockedWrite = true
    return { stop: () => this.lockedWrite = false }
  }

  public isLockedForRead() {
    return this.lockedRead.findIndex(i => i) >= 0
  }

  public isLockedForWrite() {
    return this.lockedWrite
  }
}
