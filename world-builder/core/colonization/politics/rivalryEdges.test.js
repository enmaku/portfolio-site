import assert from 'node:assert/strict'
import test from 'node:test'
import { openLegacyRivalry, transferRivalryOnAbsorb } from './rivalryEdges.js'

test('openLegacyRivalry adds a legacy edge once', () => {
  const once = openLegacyRivalry([], {
    aFactionId: 'a',
    bFactionId: 'b',
    createdEpoch: 3,
  })
  assert.deepStrictEqual(once, [
    { aFactionId: 'a', bFactionId: 'b', cause: 'legacy', createdEpoch: 3 },
  ])
  const twice = openLegacyRivalry(once, {
    aFactionId: 'b',
    bFactionId: 'a',
    createdEpoch: 4,
  })
  assert.equal(twice.length, 1)
})

test('transferRivalryOnAbsorb retargets loser edges onto survivor', () => {
  const edges = [
    { aFactionId: 'loser', bFactionId: 'other', cause: 'legacy', createdEpoch: 1 },
    { aFactionId: 'loser', bFactionId: 'winner', cause: 'legacy', createdEpoch: 1 },
    { aFactionId: 'keep', bFactionId: 'other', cause: 'resource', createdEpoch: 2 },
  ]
  const next = transferRivalryOnAbsorb(edges, {
    loserFactionId: 'loser',
    survivorFactionId: 'winner',
    createdEpoch: 9,
  })
  assert.ok(next.some((e) => e.aFactionId === 'winner' && e.bFactionId === 'other'))
  assert.ok(!next.some((e) => e.aFactionId === 'loser' || e.bFactionId === 'loser'))
  assert.ok(next.some((e) => e.aFactionId === 'keep' && e.bFactionId === 'other'))
})
