import assert from 'node:assert/strict'
import test from 'node:test'
import { createMatchSeed } from './seed.js'

test('createMatchSeed uses crypto entropy when available', () => {
  const seed = createMatchSeed({
    cryptoObj: {
      getRandomValues(array) {
        array[0] = 123
        return array
      },
    },
    now: () => 999,
    warn: () => {
      throw new Error('warn should not be called when crypto exists')
    },
  })
  assert.equal(seed, 123)
})

test('createMatchSeed falls back to time and warns when crypto unavailable', () => {
  let warned = false
  const seed = createMatchSeed({
    cryptoObj: null,
    now: () => 777,
    warn: () => {
      warned = true
    },
  })
  assert.equal(seed, 777)
  assert.equal(warned, true)
})
