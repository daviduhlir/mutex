import cluster from 'cluster'
import { EventEmitter } from 'events'

export class MutexCommLayer {
  public onClusterMessage(callback: (worker: any, message: any) => void) {
    cluster.on('message', (worker, message: any) => {
      if (message.__mutexMessage__) {
        callback(worker, message)
      }
    })
  }

  public onProcessMessage(callback: (message: any) => void) {
    process.on('message', (message: any) => {
      if (message.__mutexMessage__) {
        callback(message)
      }
    })
  }

  public processSend(message: any) {
    process?.send?.({
      __mutexMessage__: true,
      ...message,
      workerId: cluster.worker?.id,
    })
  }

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
}
