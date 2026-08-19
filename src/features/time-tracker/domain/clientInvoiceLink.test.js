import assert from 'node:assert/strict'
import test from 'node:test'
import { createClientInvoiceSecret } from './clientInvoiceLink.js'

test('client invoice secret is 32 bytes of hex', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => index)
  const secret = createClientInvoiceSecret((target) => {
    target.set(bytes)
    return target
  })
  assert.equal(secret.length, 64)
  assert.equal(secret, [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''))
})
