import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  decideResumeFlow,
  loadCurrentMatch,
  persistCurrentMatch,
} from './currentMatch.js'

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

test('persist and load current match roundtrip', () => {
  const storage = createMemoryStorage()
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-1',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: { turn: 1 },
    history: [],
  }
  persistCurrentMatch(storage, match)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.match, match)
})

test('schema mismatch hard resets persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION - 1, id: 'stale', state: {}, history: [] })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'SCHEMA_MISMATCH')
  assert.equal(storage.getItem('dungeon-runner/current-match'), null)
})

test('invalid persisted shape hard resets current match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION, id: 'bad-shape' })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'INVALID_SHAPE')
  assert.equal(storage.getItem('dungeon-runner/current-match'), null)
})

test('resume flow does not resume malformed persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION, id: 'bad-shape' })
  assert.deepEqual(decideResumeFlow(storage), { mode: 'start-new' })
})

test('resume flow surfaces resume when persisted match exists', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-1',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  assert.deepEqual(decideResumeFlow(storage), { mode: 'resume-or-start-new' })
})

test('start new clears current match before overwrite', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'old',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  clearCurrentMatch(storage)
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'new',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(loaded.match.id, 'new')
})

test('persisted current match keeps nn seat metadata', () => {
  const storage = createMemoryStorage()
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-nn',
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    state: { nnSeatMetadata: { 'seat-2': { backend: 'cpu', modelId: 'latest', fallbackReason: null } } },
    history: [],
  }
  persistCurrentMatch(storage, match)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.match.state.nnSeatMetadata['seat-2'], {
    backend: 'cpu',
    modelId: 'latest',
    fallbackReason: null,
  })
})
