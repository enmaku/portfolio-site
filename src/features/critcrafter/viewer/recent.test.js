import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRecent, rememberRecent, RECENT_KEY } from './recent.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
  }
}

test('loadRecent is empty with no storage entry', () => {
  assert.deepEqual(loadRecent(memoryStorage()), [])
})

test('rememberRecent puts the newest first and keeps only three', () => {
  const s = memoryStorage()
  rememberRecent('1', 'A', s)
  rememberRecent('2', 'B', s)
  rememberRecent('3', 'C', s)
  rememberRecent('4', 'D', s)
  assert.deepEqual(
    loadRecent(s).map((r) => r.id),
    ['4', '3', '2'],
  )
})

test('reloading an existing id moves it to the front and refreshes its label', () => {
  const s = memoryStorage()
  rememberRecent('1', 'Old', s)
  rememberRecent('2', 'B', s)
  rememberRecent('1', 'New', s)
  assert.deepEqual(loadRecent(s), [
    { id: '1', name: 'New' },
    { id: '2', name: 'B' },
  ])
})

test('corrupt storage reads as empty and unavailable storage never throws', () => {
  assert.deepEqual(loadRecent(memoryStorage({ [RECENT_KEY]: '{nope' })), [])
  assert.deepEqual(loadRecent(memoryStorage({ [RECENT_KEY]: '[{"id":5}]' })), [])
  const broken = {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
  }
  assert.deepEqual(loadRecent(broken), [])
  assert.doesNotThrow(() => rememberRecent('1', 'A', broken))
  assert.deepEqual(loadRecent(null), [])
})
