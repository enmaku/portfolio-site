export function createMatchSeed(options = {}) {
  const cryptoObj = Object.hasOwn(options, 'cryptoObj') ? options.cryptoObj : globalThis.crypto
  const now = options.now ?? Date.now
  const warn = options.warn ?? console.warn
  if (cryptoObj?.getRandomValues) {
    const array = new Uint32Array(1)
    cryptoObj.getRandomValues(array)
    return array[0] >>> 0
  }
  warn('Dungeon Runner seed fallback: crypto entropy unavailable, using time-based seed.')
  return (Number(now()) >>> 0) || 1
}
