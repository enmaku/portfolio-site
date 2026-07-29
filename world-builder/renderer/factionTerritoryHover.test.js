import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFactionTerritoryHoverIndex,
  factionTerritoryHighlightKey,
  hitTestFactionTerritoryHighlight,
} from './factionTerritoryHover.js'

test('factionTerritoryHighlightKey distinguishes faction and unaligned targets', () => {
  assert.strictEqual(factionTerritoryHighlightKey(null), '')
  assert.strictEqual(
    factionTerritoryHighlightKey({ type: 'faction', factionId: 'faction-a' }),
    'faction:faction-a',
  )
  assert.strictEqual(
    factionTerritoryHighlightKey({ type: 'unaligned', settlementId: 's1' }),
    'unaligned:s1',
  )
})

test('hitTestFactionTerritoryHighlight returns faction for shared claims and unaligned for free towns', () => {
  const worldDocument = {
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 6, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'u', x: 4, y: 4, status: 'living', factionId: null },
      { id: 'solo', x: 7, y: 7, status: 'living', factionId: 'faction-solo' },
    ],
    factions: [
      { id: 'faction-a', status: 'active', emergedEpoch: 0, settlementIds: ['a', 'b'] },
      { id: 'faction-solo', status: 'active', emergedEpoch: 1, settlementIds: ['solo'] },
    ],
    primaryClaim: {
      a: [{ x: 2, y: 1 }],
      b: [{ x: 5, y: 1 }],
      u: [{ x: 4, y: 4 }],
      solo: [{ x: 7, y: 7 }],
    },
  }
  const index = buildFactionTerritoryHoverIndex(worldDocument)
  assert.deepEqual(hitTestFactionTerritoryHighlight(worldDocument, 2.2, 1.1, index), {
    type: 'faction',
    factionId: 'faction-a',
  })
  assert.deepEqual(hitTestFactionTerritoryHighlight(worldDocument, 5.4, 1.2, index), {
    type: 'faction',
    factionId: 'faction-a',
  })
  assert.deepEqual(hitTestFactionTerritoryHighlight(worldDocument, 4.1, 4.2, index), {
    type: 'unaligned',
    settlementId: 'u',
  })
  assert.deepEqual(hitTestFactionTerritoryHighlight(worldDocument, 7.1, 7.2, index), {
    type: 'unaligned',
    settlementId: 'solo',
  })
  assert.strictEqual(hitTestFactionTerritoryHighlight(worldDocument, 0.2, 0.2, index), null)
})
