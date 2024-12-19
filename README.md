# Mutex for node.js clustered applications

This is simple mutex, that can be used between workers and will lock/unlock it using IPC messages.
It provides 2 types of locks, single-access and multi-access.

Multi-access means, multiple scopes can be opened - it's there for reading. If some part of code will lock same key with single access, all scopes will wait for it.
Single-access means, only one scope can be opened in time, all other locks with same key will wait until unlock.

Key in locks are used to connect locks together, if you will use same key, it will wait until other locks with same key will be unlocked - in case of single access locks. Key can be specified by 'layers', it means, if you will use '/', you can specify groups of locks, that will be connected together, it means, if parent key (like `parent` in `parent/myKey/child`) will be locked, we need to wait, until it unlocks, and it works in oposite way as well, so child key (like `parent/myKey/child`), needs to be unlocked before locking of your scope. You can also specify array of locks, which all will be required to be free before entering the scope.

If you wan't to use it with workers in cluster, keep in mind this module needs to be imported to master process to initialize synchronizer. Best way how to do it is to call initialize in very begining of your application like shown in this example. You can call it in master and forks same way, and it will do all neccessary setup:

```ts
import { SharedMutex } from '@david.uhlir/mutex'
import * as cluster from 'cluster'

SharedMutex.setOptions({ ... })
```

You can also pass your own configuration during initialize. But keep in mind, in all forks (and also in master), configuration must be completly same. Example of configuration:

Available options:
```ts
export interface MutexSynchronizerOptions {
  /**
   * Detect dead ends
   */
  debugDeadEnds?: boolean

  /**
   * Report debug info with stack
   */
  debugWithStack?: boolean

  /**
   * Default max locking time
   */
  defaultMaxLockingTime?: number

  /**
   * Rejects scope in timeout, error will be thrown
   */
  continueOnTimeout?: boolean

  /**
   * Algorythm for unlocking
   */
  algorythm?: (queue: LocalLockItem[], changes: string[], deadEndNotify: (lock: LocalLockItem, inCollisionHashes: string[]) => void) => void

  /**
   * Timeout handler, for handling if lock was freezed for too long time
   * You can set this handler to your own, to make decision what to do in this case
   * You can use methods like getLockInfo or resetLockTimeout to get info and deal with this situation
   * Default behaviour is to log it, if it's on master, it will throws error. If it's fork, it will kill it.
   */
  timeoutHandler?: (item: LocalLockItem) => void
}
```

- debugDeadEnds is flag, that will enable or disable dead ends detection, we are recommending to keep this on, if you are not facing any performance issue.
- debugWithStack is flag, that will enable or disable keeping stack of scope for better debugging, we are recommending to keep this on, if you are not facing any performance issue.
- defaultMaxLockingTime is time that will be set as timeout of mutex if it's not specified in the lock call
- continueOnTimeout is setup of behaviour, what should happen with lock in case of timeout, true means, lock will throw exception and result will not be awaited anymore
- algorythm is function, that is responsible for unlocking scopes in right order
- timeoutHandler is handler called when any scope reaches timeout in execution time. By default we just throw exception, you can doo whatever you want, but unlock will be called anyway.

## Mechanics of locks

Every each lock before going into scope is asking synchronizer, if we are able to continue. This is happening immediately after lock method call and after another lock being unlocked. We calling it mutex tick. Internaly all locks are sorted into queue, in order how it's arrived to synchronizer. Tick will decide, who can continue, and who should be first in order.
Lock, that can continue must have "clear way", it means, there can't by any other locked lock with same key (or child key, parental key) in case of single acces, or locked locks needs to have multi access enabled - in case we are working with multi access lock. Multi access locks can enter theirs scopes together, selecting of locks, that can enter theirs scopes in same time is drivven by order in queue, if there is multi access items queued up in a row, it will open them together.

## Locks setup

There is several flags and definitions, that can change behaviour of locks.
Every lock can has specified maxLockingTime, it's longest time, when scope can be locked. After this time, mutex will throw exception to prevent keeping app in frozen state. This behaviour can be overrided by setting `Mutex.setOptions({ timeoutHandler: function })` resp. `SharedMutex.setOptions({ timeoutHandler: function })` handler to your custom. Keep in mind, lock timeout is measured from the time when the first attempt to open scope occurs.

## Usage of locks

### Only one scope can be opened:
``` ts
import { SharedMutex } from '@david.uhlir/mutex'

SharedMutex.lockSingleAccess('test', async () => {
    console.log('Lock test 1')
    await delay(1000)
    console.log('Unlock test 1')
})

SharedMutex.lockSingleAccess('test', async () => {
    console.log('Lock test 2')
    await delay(1000)
    console.log('Unlock test 2')
})

```

### Both scopes can be opened together:
``` ts
import { SharedMutex } from '@david.uhlir/mutex'

SharedMutex.lockMultiAccess('test', async () => {
    console.log('Lock test 1')
    await delay(1000)
    console.log('Unlock test 1')
})

SharedMutex.lockMultiAccess('test', async () => {
    console.log('Lock test 2')
    await delay(1000)
    console.log('Unlock test 2')
})

```

## You can also use it as decorator

``` ts
import { SharedMutexDecorators } from '@david.uhlir/mutex'

class Test {
  @SharedMutexDecorators.lockSingleAccess('mutex')
  static async singleAccessTest() {
    console.log(`Lock test`)
  }

  @SharedMutexDecorators.lockMultiAccess('mutex')
  static async multiAccessTest() {
    console.log(`Lock test`)
  }
}
```

## Dead ends

In some cases, you can create construction, which can not be opened. We are calling it dead end, as the application is not able to recover from this state. To prevent it, we are detecting this pattern in time of processing continue stage of lock, and throwing exception in scope waiting time. Exception is based on internal notifications with key MUTEX_NOTIFIED_EXCEPTION.
This feature must be turned on for purpose, as it's causing decrease of performance. Simple calling of `Mutex.setOptions({ debugDeadEnds: true }` resp. `SharedMutex.setOptions({ debugDeadEnds: true }` in all forks will do the trick. There is two way we are approaching dead ends detection, we are trying to detect it on worker itself first by stack, and by all mutexes running in this fork. However worker does not know nothing about other workers, we are detecting it again in synchronizer - in master process.

Example of dead end case:
```ts
await SharedMutex.lockMultiAccess('root', async () => {
  await SharedMutex.lockSingleAccess('root', async () => {
    ...something
  })
})
await SharedMutex.lockMultiAccess('root', async () => {
  await SharedMutex.lockSingleAccess('root', async () => {
    ...something
  })
})
```

And basic explanation: Both multi-access scopes will be accessed together, and inside of it, it will waits for single access scopes. Unfortunately, both inner single access scopes will wait for unlocking all multiaccess scopes with related keys. Parent scope will be solved easily, as we know, its parent of it, but there is another one, which is not parent, and we should wait for it as well. It resulting in never ending wait for unlock of all keys, to access single access scope.

ISC