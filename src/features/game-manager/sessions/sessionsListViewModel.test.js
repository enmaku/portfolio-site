import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSessionGameGroups,
  sessionGameGroupKey,
  sessionSortMs,
} from './sessionsListViewModel.js'

test('sessionGameGroupKey prefers catalog then custom ids', () => {
  assert.equal(sessionGameGroupKey({ kind: 'catalog', catalogEntryId: '13', title: 'Catan' }), 'catalog:13')
  assert.equal(sessionGameGroupKey({ kind: 'custom', id: 'c1', title: 'Home' }), 'custom:c1')
})

test('sessionSortMs uses createdAt then id timestamp', () => {
  assert.equal(sessionSortMs({ createdAt: 1000 }), 1000)
  const ms = Date.now()
  const id = `session_${ms.toString(36)}_abc`
  assert.equal(sessionSortMs({ id }), ms)
})

test('buildSessionGameGroups nests sessions under games newest first', () => {
  const sessions = [
    {
      id: 's-old',
      createdAt: 100,
      game: { kind: 'catalog', catalogEntryId: '13', title: 'Catan' },
      presentPlayers: [{ recordedPlayerId: 'p1' }],
      state: 'complete',
    },
    {
      id: 's-new',
      createdAt: 300,
      game: { kind: 'catalog', catalogEntryId: '13', title: 'Catan' },
      presentPlayers: [{ recordedPlayerId: 'p1' }, { recordedPlayerId: 'p2' }],
      state: 'setup',
    },
    {
      id: 's-other',
      createdAt: 200,
      game: { kind: 'custom', id: 'c1', title: 'Homebrew' },
      presentPlayers: [],
      state: 'playing',
    },
  ]

  const groups = buildSessionGameGroups(sessions)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].key, 'catalog:13')
  assert.deepEqual(
    groups[0].sessions.map((s) => s.id),
    ['s-new', 's-old'],
  )
  assert.equal(groups[1].key, 'custom:c1')
  assert.equal(groups[0].sessions[0].presentPlayers.length, 2)
})
