declare let cluster: {
    isPrimary: boolean;
    isWorker: boolean;
    worker: any;
    workers: any;
    on: any;
};
export default cluster;
