// cluster mock
let cluster = {
  isMaster: true,
  isWorker: false,
  worker: null,
  workers: null,
  on: null,
}

try {
  cluster = require('cluster')
} catch (e) {}

export default cluster
