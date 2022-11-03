declare let cluster: {
    isMaster: boolean;
    isWorker: boolean;
    worker: any;
    workers: any;
    on: any;
};
export default cluster;
