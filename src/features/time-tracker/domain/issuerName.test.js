import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultIssuerName } from './issuerName.js'

test('issuer name defaults from Firebase display name when present', () => {
  assert.equal(defaultIssuerName({ displayName: ' Ada Lovelace ' }), 'Ada Lovelace')
})

test('issuer name is empty when no display name is set', () => {
  assert.equal(defaultIssuerName({ displayName: '' }), '')
  assert.equal(defaultIssuerName(null), '')
})
