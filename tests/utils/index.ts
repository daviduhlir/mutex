export * from './RWSimulator'

export function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export function flatten(arr: any[]) {
  return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
}
