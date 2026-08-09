/**
 * @param {string} label
 * @param {Record<string, unknown>} params
 * @param {readonly string[]} knownKeys
 */
export function assertKnownParams(label, params, knownKeys) {
  const known = new Set(knownKeys)
  for (const key of Object.keys(params)) {
    if (!known.has(key)) {
      throw new Error(`${label} received unknown parameter: ${key}`)
    }
  }
}
