import cluster from '../utils/cluster'
import { ACTION, ERROR } from '../utils/constants'
import { LocalLockItem } from '../utils/interfaces'
import { MutexError } from '../utils/MutexError'
import { randomHash } from '../utils/utils'
import { LocalMutexSynchronizer } from './LocalMutexSynchronizer'
import { MutexSynchronizer, MutexSynchronizerOptions } from './MutexSynchronizer'
import version from '../utils/version'
import { Awaiter } from '../utils/Awaiter'

/**********************************
 *
 * Shared Mutex synchronizer
 *
 ***********************************/
export class SharedMutexSynchronizer extends MutexSynchronizer {
  // waiting messages
  protected messageQueue: {
    id: string
    resolve: (result: any) => void
    reject: (err: Error) => void
  }[] = []

  // synchronizer
  protected masterSynchronizer: LocalMutexSynchronizer

  // worker verify awaiter
  protected verifyAwaiter = new Awaiter(5000)

  /**
   * Construct with options
   */
  constructor(options: MutexSynchronizerOptions = {}, readonly identifier: string) {
    super(options)
    this.initialize()
  }

  /**
   * Lock mutex
   */
  public async lock(lock: LocalLockItem, codeStack?: string) {
    if (this.masterSynchronizer) {
      return this.masterSynchronizer.lock(lock, codeStack)
    }
    await this.verifyAwaiter.wait()
    await this.sendProcessMessage({
      action: ACTION.LOCK,
      lock,
      codeStack,
    })
  }

  /**
   * Unlock handler
   * @param key
   */
  public async unlock(hash?: string, codeStack?: string) {
    if (this.masterSynchronizer) {
      return this.masterSynchronizer.unlock(hash, codeStack)
    }
    await this.verifyAwaiter.wait()
    await this.sendProcessMessage({
      action: ACTION.UNLOCK,
      hash,
      codeStack,
    })
  }

  /**
   * Forced unlock of worker
   * @param id
   */
  protected workerUnlockForced(workerId: number) {
    this.masterSynchronizer.unlockForced(i => i.workerId === workerId)
  }

  /**
   * Handle master incomming message
   * @param message
   */
  protected async handleMasterIncomingMessage(message: any, worker?: any) {
    if (message.id) {
      if (message.action === ACTION.LOCK) {
        const result = await SharedMutexSynchronizer.executeMethod(() => this.lock(message.lock, message.codeStack))
        this.sendMasterMessage(worker, {
          id: message.id,
          result: result.result,
          error: result.error,
        })
      } else if (message.action === ACTION.UNLOCK) {
        const result = await SharedMutexSynchronizer.executeMethod(() => this.unlock(message.hash, message.codeStack))
        this.sendMasterMessage(worker, {
          id: message.id,
          result: result.result,
          error: result.error,
        })
      } else if (message.action === ACTION.VERIFY) {
        this.sendMasterMessage(worker, {
          id: message.id,
          result: {
            version,
            options: this.options,
          },
          error: null,
        })
      }
    }
  }

  /**
   * Handle worker incomming message
   * @param message
   */
  protected handlerWorkerIncomingMessage(message: any) {
    if (message.id) {
      const item = this.messageQueue.find(item => item.id === message.id)
      if (item) {
        if (message.error) {
          if (message.error.key) {
            item.reject(new MutexError(message.error.key, message.error.message, message.error.lock, message.error.details))
          } else {
            item.reject(new Error(message.error.message))
          }
        } else {
          item.resolve(message.result)
        }
      }
    }
  }

  /**
   * Worker/master init
   */
  protected async initialize() {
    if (cluster.isWorker) {
      // attach events from master
      process.on('message', (message: any) => {
        if (message.__mutexMessage__ && message.__mutexIdentifier__ === this.identifier) {
          this.messageQueue = this.messageQueue.filter(item => item.id !== message.id)
          this.handlerWorkerIncomingMessage(message)
        }
      })

      const verifyResult = await this.sendProcessMessage<{ version: string }>({
        action: ACTION.VERIFY,
        version,
      })
      if (verifyResult.version === version) {
        this.verifyAwaiter.resolve()
      } else {
        this.verifyAwaiter.reject(
          new MutexError(
            ERROR.MUTEX_DIFFERENT_VERSIONS,
            'This is usually caused by more than one instance of SharedMutex package installed together.',
          ),
        )
      }
    } else {
      this.masterSynchronizer = new LocalMutexSynchronizer(this.options)
      // attach events from cluster
      cluster.on('exit', worker => this.workerUnlockForced(worker.id))
      cluster.on('message', (worker, message: any) => {
        if (message.__mutexMessage__ && message.__mutexIdentifier__ === this.identifier) {
          this.handleMasterIncomingMessage(worker, message)
        }
      })
    }
  }

  /**
   * Send message and wait response
   */
  protected async sendProcessMessage<T>(message: any): Promise<T> {
    if (!cluster.isWorker) {
      throw new Error(`Send process message is for worker only`)
    }
    const id = randomHash()
    const waiter = new Promise<T>((resolve, reject) => {
      this.messageQueue.push({
        id,
        resolve,
        reject,
      })
    })
    process?.send?.({
      __mutexMessage__: true,
      __mutexIdentifier__: this.identifier,
      id,
      ...message,
    })
    return waiter
  }

  /**
   * Send message and wait response
   */
  protected sendMasterMessage(worker: any, message: any) {
    if (cluster.isWorker) {
      throw new Error(`Send process message is for master only`)
    }
    worker.send({
      __mutexMessage__: true,
      __mutexIdentifier__: this.identifier,
      ...message,
    })
  }

  /**
   * Execute method with handlings
   */
  protected static async executeMethod<T>(
    handler: () => Promise<T> | T,
  ): Promise<{ result: T | null; error: { message: string; [prop: string]: any } | null }> {
    let result: T | null = null
    let error: { message: string; [prop: string]: any } | null = null
    try {
      result = await handler()
    } catch (e) {
      if (e instanceof MutexError) {
        error = {
          key: e.key,
          lock: e.lock,
          message: e.message,
          details: e.details,
          stack: e.stack,
        }
      } else {
        error = {
          message: e.message,
          stack: e.stack,
        }
      }
    }
    return {
      result: result,
      error: error,
    }
  }
}
