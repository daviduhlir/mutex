import { EventEmitter } from 'events'

// cluster mock
let cluster = {
    isMaster: true,
    isWorker: false,
    worker: null,
    workers: null,
    on: null,
}

try {
    cluster = require('cluster')
} catch (e) {}

/**
 * Utils class
 */
class SharedMutexUtils {
    static randomHash(): string {
        return [...Array(10)].map(x => 0).map(() => Math.random().toString(36).slice(2)).join('')
    }

    static getAllKeys(key: string): string[] {
        return key.split('/').filter(Boolean).reduce((acc, item, index, array) => {
          return [...acc, array.slice(0, index + 1).join('/')]
        }, [])
    }

    static isChildOf(key: string, parentKey: string): boolean {
        const childKeys = SharedMutexUtils.getAllKeys(key)
        const index = childKeys.indexOf(parentKey)
        if (index !== -1 && index !== childKeys.length - 1) {
            return true
        }
        return false
    }
}

/**
 * Handlers for master process to work
 * with mutexes
 */
const MasterHandler: {
    masterIncomingMessage: (message: any) => void;
    emitter: EventEmitter;
} = {
    masterIncomingMessage: null,
    emitter: new EventEmitter(),
};

/**
 * Unlock handler
 */
export class SharedMutexUnlockHandler {
    constructor(public readonly key: string, public readonly hash: string) {}

    unlock(): void {
        SharedMutex.unlock(this.key, this.hash);
    }
}

/**
 * Shared mutex class can lock some worker and wait for key,
 * that will be unlocked in another fork.
 */
export class SharedMutex {
    /**
     * Lock some async method
     * @param keysPath
     * @param fnc
     */
    static async lockSingleAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
        const m = await SharedMutex.lock(key, true, maxLockingTime);

        // run function
        let r;
        try {
            r = await fnc();
        } catch (e) {
            // unlock all keys
            m.unlock();
            throw e;
        }
        // unlock all keys
        m.unlock();
        return r;
    }

    /**
     * Lock some async method
     * @param keysPath
     * @param fnc
     */
    static async lockMultiAccess<T>(key: string, fnc: () => Promise<T>, maxLockingTime?: number): Promise<T> {
        // lock all sub keys
        const m = await SharedMutex.lock(key, false, maxLockingTime);

        let r;
        try {
            r = await fnc();
        } catch (e) {
            // unlock all keys
            m.unlock();
            throw e;
        }
        // unlock all keys
        m.unlock();
        return r;
    }

    /**
     * Lock key
     * @param key
     */
    static async lock(key: string, singleAccess?: boolean, maxLockingTime?: number): Promise<SharedMutexUnlockHandler> {
        const hash = SharedMutexUtils.randomHash();

        const eventHandler = cluster.isWorker ? process : MasterHandler.emitter;

        // waiter function
        const waiter = new Promise((resolve: (value: any) => void) => {
            const handler = message => {
                if (message.__mutexMessage__ && message.hash === hash) {
                    eventHandler.removeListener('message', handler);
                    resolve(null);
                }
            }
            eventHandler.addListener('message', handler);
        });

        SharedMutex.sendAction(key, 'lock', hash, {
            maxLockingTime,
            singleAccess,
        });

        await waiter;

        return new SharedMutexUnlockHandler(key, hash);
    }

    /**
     * Unlock key
     * @param key
     */
    static unlock(key: string, hash: string): void {
        SharedMutex.sendAction(key, 'unlock', hash);
    }

    /**
     * Send action to master
     * @param key
     * @param action
     */
    protected static sendAction(key: string, action: string, hash: string, data: any = null): void {
        const message = {
            __mutexMessage__: true,
            action,
            key,
            hash,
            ...data,
        };

        if (cluster.isWorker) {
            process.send({
                ...message,
                workerId: cluster.worker?.id,
            });
        } else {
            MasterHandler.masterIncomingMessage({
                ...message,
                workerId: 'master',
            });
        }
    }
}

/**********************************
 *
 * cluster synchronizer
 *
 ***********************************/
interface LocalLockItem {
    workerId: number | 'master';
    singleAccess: boolean;
    hash: string;
    timeout?: any;
    isRunning?: boolean;
    key: string;
}

if (cluster.isMaster) {
    let localLocksQueue: LocalLockItem[] = [];

    /**
     * Tick of mutex run, it will continue next mutex(es) in queue
     */
    function mutexTickNext() {
        const allKeys = localLocksQueue.reduce((acc, i) => {
            return [...acc, i.key].filter((value, ind, self) => self.indexOf(value) === ind)
        }, [])

        for(const key of allKeys) {
            const queue = localLocksQueue.filter(i => i.key === key)
            const runnings = queue.filter(i => i.isRunning)

            const allKeys = SharedMutexUtils.getAllKeys(key)
            const posibleBlockingItem = localLocksQueue.find(i => i.isRunning && allKeys.includes(i.key) || SharedMutexUtils.isChildOf(i.key, key))

            // if there is something to continue
            if (queue?.length) {
                // if next is for single access
                if (queue[0].singleAccess && !runnings?.length && !posibleBlockingItem) {
                    mutexContinue(queue[0])

                // or run all multiple access together
                } else if (runnings.every(i => !i.singleAccess) && !posibleBlockingItem?.singleAccess) {
                    for (const item of queue) {
                        if (item.singleAccess) {
                            break;
                        }
                        mutexContinue(item);
                    }
                }
            }
        }
    }

    /**
     * Lock mutex
     */
    function lock(key: string, workerId: number, singleAccess: boolean, hash: string, maxLockingTime: number) {
        // prepare new lock item
        const item: LocalLockItem = {
            workerId,
            singleAccess,
            hash,
            key,
        }

        // add it to locks
        localLocksQueue.push(item);

        // set timeout if provided
        if (maxLockingTime) {
            item.timeout = setTimeout(() => unlock(hash), maxLockingTime);
        }
        mutexTickNext()
    }

    /**
     * Continue worker in queue
     * @param key
     */
    function mutexContinue(workerIitem: LocalLockItem) {
        workerIitem.isRunning = true;

        const message = {
            __mutexMessage__: true,
            hash: workerIitem.hash,
        };

        if (workerIitem.workerId === 'master') {
            MasterHandler.emitter.emit('message', message);
        } else {
            cluster.workers[workerIitem.workerId].send(message);
        }
    }

    /**
     * Unlock handler
     * @param key
     * @param workerId
     */
    function unlock(hash?: string) {
        // clear timeout, if exists
        const f = localLocksQueue.find(foundItem => foundItem.hash === hash);
        if (!f) {
            return;
        }

        if (f.timeout) {
            clearTimeout(f.timeout);
        }

        // remove from queue
        localLocksQueue = localLocksQueue.filter(item => item.hash !== hash);

        // next tick... unlock something, if waiting
        mutexTickNext()
    }

    /**
     * Handle master incomming message
     * @param message
     */
    function masterIncomingMessage(message: any) {
        if (!(message as any).__mutexMessage__ || !message.action) {
            return;
        }

        // lock
        if (message.action === 'lock') {
           lock(message.key, message.workerId, message.singleAccess, message.hash, message.maxLockingTime);
        // unlock
        } else if (message.action === 'unlock') {
            unlock(message.hash);
        }
    }

    /**
     * Forced unlock of worker
     * @param id
     */
    function workerUnlockForced(workerId: number) {
        localLocksQueue
            .filter(i => i.workerId === workerId)
            .forEach(i => unlock(i.hash));
    }

    // if we are using clusters at all
    if (cluster && typeof cluster.on === 'function') {
            // listen worker events
        Object.keys(cluster.workers).forEach(workerId => {
            cluster.workers[workerId].on('message', masterIncomingMessage);
        })
        cluster.on('fork', worker => {
            worker.on('message', masterIncomingMessage);
        })
        cluster.on('exit', worker => {
            workerUnlockForced(worker.id);
        })
    }

    // setup functions for master
    MasterHandler.masterIncomingMessage = masterIncomingMessage;
}
