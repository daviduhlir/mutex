import cluster from 'cluster'
import { MutexCommLayer } from './MutexCommLayer'

/**
 * Mutexes communication layer,
 * All comm between forks and master are called here
 */
export class IPCMutexCommLayer extends MutexCommLayer {
  /**
   * Listen all messages from cluster (for master)
   */
  public onClusterMessage(callback: (worker: any, message: any) => void) {
    cluster.on('message', (worker, message: any) => {
      if (message.__mutexMessage__) {
        callback(worker, message)
      }
    })
  }

  /**
   * Listen all messages on process (for worker)
   */
  public onProcessMessage(callback: (message: any) => void) {
    process.on('message', (message: any) => {
      if (message.__mutexMessage__) {
        callback(message)
      }
    })
  }

  /**
   * Send message to worker
   */
  public workerSend(worker: any, message: any) {
    // TODO send it to layer!
    worker.send(
      {
        __mutexMessage__: true,
        ...message,
      },
      err => {
        if (err) {
          // TODO - not sure what to do, worker probably died
        }
      },
    )
  }

  /**
   * Send message from worker
   */
  public processSend(message: any) {
    process?.send?.({
      __mutexMessage__: true,
      ...message,
      workerId: cluster.worker?.id,
    })
  }
}
