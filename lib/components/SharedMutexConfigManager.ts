import { IPCMutexCommLayer } from './comm/IPCMutexCommLayer'
import { MutexCommLayer } from './comm/MutexCommLayer'
import { Awaiter } from '../utils/Awaiter'
import { SharedMutexConfiguration } from '../utils/interfaces'

export const defaultConfiguration: SharedMutexConfiguration = {
  defaultMaxLockingTime: undefined,
  communicationLayer: 'IPC',
}

export class SharedMutexConfigManager {
  protected static configuration: SharedMutexConfiguration = defaultConfiguration
  protected static comm: MutexCommLayer
  protected static initAwaiter: Awaiter = new Awaiter()

  /**
   * Initialize master handler
   */
  static initialize(configuration?: Partial<SharedMutexConfiguration>): boolean {
    if (configuration) {
      SharedMutexConfigManager.configuration = {
        ...defaultConfiguration,
        ...configuration,
      }
    }

    // setup comm layer
    if (SharedMutexConfigManager.configuration.communicationLayer === 'IPC') {
      SharedMutexConfigManager.comm = new IPCMutexCommLayer()
    } else {
      SharedMutexConfigManager.comm = SharedMutexConfigManager.configuration.communicationLayer
    }

    // comm is not prepared and is not set yet... wait for next init call
    if (!SharedMutexConfigManager.comm) {
      if (SharedMutexConfigManager.initAwaiter) {
        SharedMutexConfigManager.initAwaiter.resolve()
      }
      SharedMutexConfigManager.initAwaiter = new Awaiter()
      return false
    }

    SharedMutexConfigManager.initAwaiter.resolve()
    return true
  }

  /**
   * Get comm with wait
   */
  static async getComm() {
    await SharedMutexConfigManager.initAwaiter.wait()
    return SharedMutexConfigManager.comm
  }

  /**
   * Get whole config
   */
  static async getConfiguration() {
    await SharedMutexConfigManager.initAwaiter.wait()
    return SharedMutexConfigManager.configuration
  }

  /**
   * True, if using default config
   */
  static async getUsingDefaultConfig() {
    await SharedMutexConfigManager.initAwaiter.wait()
    return SharedMutexConfigManager.configuration === defaultConfiguration
  }
}
