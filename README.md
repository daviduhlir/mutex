# Mutex for node.js clustered applications

This is simple mutex, that can be used between workers and will lock/unlock it using IPC messages.
It provides 2 types of locks, single-access and multi-access.

Multi-access means, multiple scopes can be opened - it's there for reading. If some part of code will lock same key with single access, all scopes will wait for it.
Single-access means, only one scope can be opened in time, all other locks with same key will wait until unlock.

Key in locks are used to connect locks together, if you will use same key, it will wait until other locks with same key will be unlocked - in case of single access locks. Key can be specified by 'layers', it means, if you will use '/' (or put keys to array in right order), you can specify groups of locks, that will be connected together, it means, if parent key (like `parent` in `parent/myKey/child`) will be locked, we need to wait, until it unlocks, and it works in oposite way as well, so child key (like `parent/myKey/child`), needs to be unlocked before locking of your scope.

If you wan't to use it with workers in cluster, keep in mind this module needs to be imported to master process to initialize synchronizer. Best way how to do it is to call initialize in very begining of your application like shown in this example. You can call it in master and forks same way, and it will do all neccessary setup:
```ts
import { SharedMutex } from '@david.uhlir/mutex'
import * as cluster from 'cluster'

SharedMutex.initialize()
```

You can also pass your own configuration during initialize. But keep in mind, in all forks (and also in master), configuration must be completly same. Example of configuration:

```ts
import { SharedMutex } from '@david.uhlir/mutex'
import * as cluster from 'cluster'

SharedMutex.initialize({
  defaultMaxLockingTime: 1000,
  continueOnTimeout: false,
})

```

configuration interface:
```ts
interface SharedMutexConfiguration {
  /**
   * Default locking time, which will be used for all locks, if it's undefined, it will keep it unset
   */
  defaultMaxLockingTime: number
  /**
   * Timeout behaviour
   */
  continueOnTimeout?: boolean
  /**
   * Communication layer
   */
  communicationLayer?: MutexCommLayer
}
```

- defaultMaxLockingTime is time that will be set as timeout of mutex if it's not specified in the lock call
- continueOnTimeout is setup of behaviour, what should happen with lock in case of timeout, true means, lock will throw exception and result will not be awaited anymore
- communicationLayer setup of communication layer, by default it's IPC

## Overriding IPC communication

By default all forks and master are communicating by IPC messages. This behaviour is set by communicationLayer property in configuration. Default value is 'IPC', that means, it will creates IPC layer and will communicate through it. You can set your own instance of MutexCommLayer into config, and it will be used immediatly. All message operations are waiting, until complete configuration will be set. This can be used for creating this layer asynchronous. In case of asynchronous layer (like some socket), you need to set this value to null for first touch, and then you have time to create and connect your layer, after that you should call initialize again and it will unblock all messages and continue.

Like in this example:
```ts
SharedMutex.initialize({
  communicationLayer: null,
})

const layer = new MyOwnCommLayer()

layer.on('complete', () => {
  SharedMutex.initialize({
    communicationLayer: layer,
  })
})
```

## Mechanics of locks

Every each lock before going into scope is asking synchronizer, if we are able to continue. This is happening immediately after lock method call and after another lock being unlocked. We calling it mutex tick. Internaly all locks are sorted into queue, in order how it's arrived to synchronizer. Tick will decide, who can continue, and who should be first in order.
Lock, that can continue must have "clear way", it means, there can't by any other locked lock with same key (or child key, parental key) in case of single acces, or locked locks needs to have multi access enabled - in case we are working with multi access lock. Multi access locks can enter theirs scopes together, selecting of locks, that can enter theirs scopes in same time is drivven by order in queue, if there is multi access items queued up in a row, it will open them together.

## Locks setup

There is several flags and definitions, that can change behaviour of locks.
Every lock can has specified maxLockingTime, it's longest time, when scope can be locked. After this time, mutex will throw exception to prevent keeping app in frozen state. This behaviour can be overrided by setting `SharedMutexSynchronizer.timeoutHandler` handler to your custom. Keep in mind, lock timeout is measured from the time when the first attempt to open scope occurs.

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
This feature must be turned on for purpose, as it's causing decrease of performance. Simple calling of `SharedMutexSynchronizer.debugDeadEnds = true` in all forks will do the trick.

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