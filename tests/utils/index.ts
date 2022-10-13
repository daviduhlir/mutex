export * from './RWSimulator'

export function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}
