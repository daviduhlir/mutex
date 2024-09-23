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
   * Communication layer
   */
  communicationLayer?: MutexCommLayer
}
```

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
Every lock can has specified maxLockingTime, it's longest time, when scope can be locked. After this time, mutex will throw exception to prevent keeping app in frozen state. This behaviour can be overrided by setting `SharedMutexSynchronizer.timeoutHandler` handler to your custom.

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

## Safe handling of frozen promises

There is mechanics, that you can use in case some of your promise will be frozen and you dont want to takes a care about that (eg. some child process freezes).
You can use MutexSafeCallbackHandler as callback in lockSingleAccess, lockMultiAccess, and lockAccess methods. There is method unlock() on this handler, you can use it to force unlock this scope. If you will provides timeout parameter, it will triggers this force unlock automaticaly. If you want to handle it by yourself, leave timeout as undefined and use onStartCallback parameter to setup your own timeout mechanics, that will be able to call unlock on it.

This is example how to use it with predefined timeout:
```ts
const safeCallback = new MutexSafeCallbackHandler(async () => delay(1000), 100)
const result = SharedMutex.lockSingleAccess('mutex', safeCallback, 200)
```

## Debugging

This is experimental feature, but in case you want extra level of info, what's going on inside of scopes, you can use reportDebugInfo function on SharedMutexSynchronizer class. This method is callen when any of mutexes changing it's state. To better see, how mutexes entering scopes, you can use DebugGuard class, which will provides you all neccessary data pairing and will write it to console.
There is posibility to write stack info in debug messages by settings `SharedMutexSynchronizer.debugWithStack` to true.

To use debugger features, just write this to begining of your code:

```ts
SharedMutexSynchronizer.reportDebugInfo = DebugGuard.reportDebugInfo
```

It will writes you messages in this format `{STATE} {KEY} {message}`, where key is exactly key of mutex, message is human readable representation of state and state is constant, which defines state, where we are pushing mutex. This states can be:
```
LOCK_TIMEOUT
SCOPE_WAITING
SCOPE_EXIT
SCOPE_CONTINUE
```

This is example of output of guard:

```
MUTEX_DEBUG mutex (S) Entering scope
MUTEX_DEBUG mutex/deepx (S) Waiting outside of scope. Posible blockers:  mutex
MUTEX_DEBUG mutexx (S) Leaving scope
MUTEX_DEBUG mutex/deepx (S) Continue into scope
MUTEX_DEBUG mutex/deepx (S) Leaving scope
```

You can use your own debugger report method, and handle states by yourself.
DebugGuard can be also configured, to prevent messy log, and log only important messages, like scopes, that was locked too long, or scopes, that was waiting for unlock too long. It can be setup by changing flags in `DebugGuard.options`.

This is options interface:

```ts
interface DebugGuardOptions {
  logEnterScope: boolean
  logWaitingOutside: boolean
  logContinue: boolean
  logLeave: boolean
  logDetail: boolean
  logContinueMinTime: number
  logLeaveMinTime: number
}
```

All the times is in miliseconds.

There is option, for simple debugging, which will collects all info about locks with stack, where the lock was called. It can be simply turned on by calling `SharedMutexSynchronizer.debugWithStack = true` in all proccesses. This will mainly shows stack trace in case, where lock failed due to MUTEX_TIMEOUT error. With this flag, it's easy to read, who blocked the lock, and if it was blocked by running locks, or waiting locks.

ISC