// cluster mock
let cluster = {
  isPrimary: true,
  isWorker: false,
  worker: null,
  workers: null,
  on: null,
}

try {
  cluster = require('node:cluster')
} catch (e) {}

export default cluster
