import test from 'node:test'
import assert from 'node:assert/strict'
import { safeLocalStorage } from './safeLocalStorage.js'

test('returns null when there is no localStorage', () => {
  assert.equal(safeLocalStorage(), null)
})

test('returns null when merely reading localStorage throws', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError')
    },
  })
  try {
    assert.equal(safeLocalStorage(), null)
  } finally {
    delete globalThis.localStorage
  }
})

test('returns the storage when it is available', () => {
  const fake = { getItem() {} }
  globalThis.localStorage = fake
  try {
    assert.equal(safeLocalStorage(), fake)
  } finally {
    delete globalThis.localStorage
  }
})
