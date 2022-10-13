import { expect, assert } from 'chai'
import { SharedMutex } from '../dist'
import { RWSimulator, delay } from './utils'
import { spawn } from 'child_process'

describe('test rw simulator', function() {
  it('lock handling', async function() {
    const rwSimulator = new RWSimulator()
    try {
      await Promise.all([
        (async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        })(),
        (async () => {
          const handler = rwSimulator.write()
          await delay(10)
          handler.stop()
          return true
        })(),
      ])
      assert(false, 'Should fails on lock error.')
    } catch(e) {
      expect(e.toString()).to.equal('Error: Already locked for read.')
    }
  })
})

describe('lock test', function() {
  it('single access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      SharedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.read()
        await delay(10)
        handler.stop()
        return true
      }),
      SharedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.read()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.findIndex(i => !i) === -1, 'All results of readings should be true')
  })

  it('multi access', async function() {
    const rwSimulator = new RWSimulator()
    const result = await Promise.all([
      Promise.all([
        SharedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
        SharedMutex.lockMultiAccess('mutex', async () => {
          const handler = rwSimulator.read()
          await delay(10)
          handler.stop()
          return true
        }),
      ]),
      SharedMutex.lockSingleAccess('mutex', async () => {
        const handler = rwSimulator.write()
        await delay(10)
        handler.stop()
        return true
      }),
    ])
    assert(result.flat().findIndex(i => !i) === -1, 'All results of readings should be true')
  })

  it('cluster test - single', async function() {
    const result: string[] = await new Promise((resolve, reject) => {

      const child = spawn('ts-node', ['./tests/complex/cluster.ts'])
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

    const expected = [
      '0:L', '0:U',
      '1:L', '1:U',
      '2:L', '2:U',
      '3:L', '3:U'
    ]

    expect(result.join('\n').split('\n').filter(i => !!i)).to.have.ordered.members(expected)
  })

  it('cluster test - multi', async function() {
    const result: string[] = await new Promise((resolve, reject) => {

      const child = spawn('ts-node', ['./tests/complex/cluster-multi.ts'])
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

    const expected = [
      'S:L', 'S:U', 'M:L',
      'M:L', 'M:L', 'M:L',
      'M:U', 'M:U', 'M:U',
      'M:U'
    ]

    expect(result.join('\n').split('\n').filter(i => !!i)).to.have.ordered.members(expected)
  })
})
