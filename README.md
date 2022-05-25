# Mutex for node.js clustered applications

This is simple mutex, that can be used between workers and will lock/unlock it using IPC messages.
It provides 2 types of locks, single-access and multi-access.

Multi-access means, multiple scopes can be opened - it's there for reading. If some part of code will lock same key with single access, all scopes will wait for it.
Single-access means, only one scope can be opened in time, all other locks with same key will wait until unlock.

If you wan't to use it with workers in cluster, keep in mind this module needs to be imported to master process to initialize synchronizer. Best way how to do it is to call initialize in master like shown in this example:
```ts
import { SharedMutexSynchronizer } from '@david.uhlir/mutex';
import * as cluster from 'cluster

if (cluster.isMaster) {
    SharedMutexSynchronizer.initializeMaster()
}

```

## Usage

``` ts
import { SharedMutex } from '@david.uhlir/mutex';

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

``` ts
import { SharedMutex } from '@david.uhlir/mutex';

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
  static async singleAccessTest(delayTime: number = 500) {
    console.log(`Lock test`)
  }

  @SharedMutexDecorators.lockMultiAccess('mutex')
  static async multiAccessTest(delayTime: number = 500) {
    console.log(`Lock test`)
  }
}

```

ISC