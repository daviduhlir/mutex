import { assert } from 'chai'
import { SharedMutex } from '../dist'
import { delay } from './utils'
import { spawn } from 'child_process'
import { checkLocksResults } from './utils'

/**
 * Locks with nested keys test
 */
describe('Stress test', function() {
  it('Big amount in parallel', async function() {

    let failed = false
    let counter = 0

    const int = setInterval(() => SharedMutex.lockMultiAccess('root', async () => {
      counter++
      await delay(2)
      counter--
    }), 2)

    await Promise.all(new Array(100).fill(null).map(() =>
      SharedMutex.lockSingleAccess('root', async () => {
        if (counter !== 0) {
          failed = true
        }
        counter++
        await delay(2)
        counter--
      })))

    clearInterval(int)

    assert(!failed, 'Single access scope should not be penetrated with any other')
  })

  it('Big amount in parallel with interval single access', async function() {

    let failed = false

    let counter = 0
    const int1 = setInterval(() => SharedMutex.lockSingleAccess('root', async () => {
      counter++
      await delay(5)
      counter--
    }), 5)
    const int2 = setInterval(() => SharedMutex.lockSingleAccess('root', async () => {
      counter++
      await delay(5)
      counter--
    }), 5)

    await delay(2000)

    clearInterval(int1)
    clearInterval(int2)

    assert(!failed, 'Single access scope should not be penetrated with any other')
  })

  it('Big amount in parallel combined multi and single access', async function() {

    let failed = false

    let counter = 0
    const int1 = setInterval(() => SharedMutex.lockSingleAccess('root', async () => {
      if (counter !== 0) {
        failed = true
      }
      counter++
      await delay(2)
      counter--
    }), 2)
    const int2 = setInterval(() => SharedMutex.lockSingleAccess('root', async () => {
      if (counter !== 0) {
        failed = true
      }
      counter++
      await delay(2)
      counter--
    }), 2)

    await Promise.all(new Array(50).fill(null).map(() =>
      SharedMutex.lockMultiAccess('root', async () => {
        counter++
        await delay(1)
        counter--
      })))

    clearInterval(int1)
    clearInterval(int2)

    assert(!failed, 'Single access scope should not be penetrated with any other')
  })

  it('Big amount in cluster', async function() {
    const result: string[] = await new Promise((resolve, reject) => {

      const child = spawn('ts-node', ['./tests/complex/cluster-stress.ts'])
      let outputs: string[] = []
      let errors: string[] = []
      child.stdout.on('data', data => outputs.push(data.toString()))
      child.stderr.on('data', data => errors.push(data.toString()))
      child.on('exit', (code) => {
        if (code === 0) {
          resolve(outputs)
        } else {
          reject(errors)
        }
      })
    })

    try {
      checkLocksResults(result.join('\n').split('\n').filter(i => !!i))
    } catch(e) {
      assert(!e, 'Result should be without error.')
    }
  })

})
