/**
 * @param {(bytes: Uint8Array) => Uint8Array} [fillRandom]
 * @returns {string}
 */
export function createClientInvoiceSecret(fillRandom) {
  const bytes = new Uint8Array(32)
  if (fillRandom) {
    fillRandom(bytes)
  } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    throw new Error('No CSPRNG available for client invoice link')
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
