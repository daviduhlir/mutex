import { assert, expect } from 'chai'
import { spawn } from 'child_process'
import { checkLocksResults } from './utils'

/**
 * Run node app to test cluster communication via IPC
 */
describe('lock test in cluster', function() {
  it('single locks', async function() {
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

    try {
      checkLocksResults(result.join('\n').split('\n').filter(i => !!i))
    } catch(e) {
      assert(!e, 'Result should be without error.')
    }
  })

  it('multi locks', async function() {
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

    try {
      checkLocksResults(result.join('\n').split('\n').filter(i => !!i))
    } catch(e) {
      assert(!e, 'Result should be without error.')
    }
  })

  it('initialization check', async function() {
    try {
      const result: string[] = await new Promise((resolve, reject) => {
        const child = spawn('ts-node', ['./tests/complex/cluster-initialization-check.ts'])
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
      assert(true, 'Should fails on error')
    } catch(e) {
      expect(e.toString().indexOf('MUTEX_MASTER_NOT_INITIALIZED')).to.not.equal(-1)
    }
  })
})
