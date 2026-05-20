import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isNnAdventurerPickEnabled,
  parseNnAdventurerPickEnabled,
} from './nnAdventurerPick.js'

test('parseNnAdventurerPickEnabled is false when unset', () => {
  assert.equal(parseNnAdventurerPickEnabled(undefined), false)
  assert.equal(parseNnAdventurerPickEnabled(null), false)
  assert.equal(parseNnAdventurerPickEnabled(''), false)
  assert.equal(parseNnAdventurerPickEnabled('   '), false)
})

test('parseNnAdventurerPickEnabled accepts strict truthy tokens', () => {
  assert.equal(parseNnAdventurerPickEnabled('1'), true)
  assert.equal(parseNnAdventurerPickEnabled('true'), true)
  assert.equal(parseNnAdventurerPickEnabled('TRUE'), true)
  assert.equal(parseNnAdventurerPickEnabled(' yes '), true)
})

test('parseNnAdventurerPickEnabled rejects other values', () => {
  assert.equal(parseNnAdventurerPickEnabled('0'), false)
  assert.equal(parseNnAdventurerPickEnabled('false'), false)
  assert.equal(parseNnAdventurerPickEnabled('no'), false)
  assert.equal(parseNnAdventurerPickEnabled('enabled'), false)
})

test('isNnAdventurerPickEnabled is false when Vite env is unset in node tests', () => {
  assert.equal(isNnAdventurerPickEnabled(), false)
})
