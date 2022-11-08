# Mutex for node.js clustered applications

This is simple mutex, that can be used between workers and will lock/unlock it using IPC messages.
It provides 2 types of locks, single-access and multi-access.

Multi-access means, multiple scopes can be opened - it's there for reading. If some part of code will lock same key with single access, all scopes will wait for it.
Single-access means, only one scope can be opened in time, all other locks with same key will wait until unlock.

Key in locks are used to connect locks together, if you will use same key, it will wait until other locks with same key will be unlocked - in case of single access locks. Key can be specified by 'layers', it means, if you will use '/' (or put keys to array in right order), you can specify groups of locks, that will be connected together, it means, if parent key (like `parent` in `parent/myKey/child`) will be locked, we need to wait, until it unlocks, and it works in oposite way as well, so child key (like `parent/myKey/child`), needs to be unlocked before locking of your scope.

If you wan't to use it with workers in cluster, keep in mind this module needs to be imported to master process to initialize synchronizer. Best way how to do it is to call initialize in master like shown in this example:
```ts
import { SharedMutex } from '@david.uhlir/mutex'
import * as cluster from 'cluster'

if (cluster.isMaster) {
    SharedMutex.initializeMaster()
}
```

## Mechanics of locks

Every each lock before going into scope is asking synchronizer, if we are able to continue. This happening immediately after lock call, but after another lock being unlocked. We calling it mutex tick. Internaly all locks are sorted into queue, in order how it's arrived to synchronizer. Tick will decide, who can continue, and who should be first in order.
Lock, that can continue must have "clear way", it means, there can't by any other locked lock with same key (or child key, parental key) in case of single acces, or locked locks needs to have multi access enabled - in case we are working with multi access lock.

## Locks setup

There is several flags and definitions, that can change behaviour of locks.
Every lock can has specified maxLockingTime, it's longest time, when scope can be locked. After this time, mutex will throw exception to prevent keeping app in frozen state. This behaviour can be overrided by setting `SharedMutexSynchronizer.timeoutHandler` handler to your custom.
Globaly you can turn off or on strict mode by setting `SharedMutex.strict`, which will change behaviour in nested locks. If we detecting nested lock with related key (key, that can affect your key), it will writes warning and open this scope in case, strict mode is off. In strict mode this will cause application to crash (or fork only).

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

ISC