import { expect } from 'chai'
import { spawn } from 'child_process'

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

    const expected = [
      '0:L', '0:U',
      '1:L', '1:U',
      '2:L', '2:U',
      '3:L', '3:U'
    ]

    expect(result.join('\n').split('\n').filter(i => !!i)).to.have.ordered.members(expected)
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

    const expected = [
      'S:L', 'S:U', 'M:L',
      'M:L', 'M:L', 'M:L',
      'M:U', 'M:U', 'M:U',
      'M:U'
    ]

    expect(result.join('\n').split('\n').filter(i => !!i)).to.have.ordered.members(expected)
  })
})
