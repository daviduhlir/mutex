# Mutex for node.js clustered applications

This is simple mutex, that can be used between workers and will lock/unlock it using IPC messages.
It provides 2 types of locks, single-access and multi-access.

Multi-access means, multiple scopes can be opened - it's there for reading. If some part of code will lock same key with single access, all scopes will wait for it.
Single-access means, only one scope can be opened in time, all other locks with same key will wait until unlock.

```
npm install @david.uhlir/mutex
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

ISC