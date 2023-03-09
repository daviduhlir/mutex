/**
 * Mutexes communication layer,
 * All comm between forks and master are called here
 */
export abstract class MutexCommLayer {
  /**
   * Listen all messages from cluster (for master)
   */
  public abstract onClusterMessage(callback: (worker: any, message: any) => void)

  /**
   * Listen all messages on process (for worker)
   */
  public abstract onProcessMessage(callback: (message: any) => void)

  /**
   * Send message to worker
   */
  public abstract workerSend(worker: any, message: any)

  /**
   * Send message from worker
   */
  public abstract processSend(message: any)
}
