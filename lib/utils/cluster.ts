// cluster mock
let cluster = {
  isMaster: true,
  isWorker: false,
  worker: null,
  workers: null,
  on: (event: string, ...args: any[]) => 0,
}

try {
  cluster = require('cluster')
} catch (e) {}

export default cluster
