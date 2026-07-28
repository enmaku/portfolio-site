import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFactionTerritoryOverlayRgba,
  factionTerritoryControlAlpha,
  factionTerritoryRgb,
  FACTION_TERRITORY_CAPITAL_ALPHA,
  FACTION_TERRITORY_UNALIGNED_ALPHA,
  FACTION_TERRITORY_UNALIGNED_RGB,
  FACTION_TERRITORY_VASSAL_ALPHA,
} from './buildFactionTerritoryOverlayRgba.js'

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

test('faction territory paints only primary claim cells', () => {
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    increment3LatchedEpoch: 1,
    settlements: [
      { id: 'a', x: 0, y: 0, status: 'living', factionId: 'faction-a' },
    ],
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 'a',
        settlementIds: ['a'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
    primaryClaim: {
      a: [{ x: 3, y: 0 }],
    },
  })
  assert.ok(rgba)
  const claim = cellOffset(3, 0, 8)
  const pin = cellOffset(0, 0, 8)
  const unclaimed = cellOffset(1, 0, 8)
  const tint = factionTerritoryRgb('faction-a')
  assert.strictEqual(rgba[claim], tint[0])
  assert.strictEqual(rgba[claim + 1], tint[1])
  assert.ok(rgba[claim + 3] > 0)
  assert.strictEqual(rgba[pin + 3], 0)
  assert.strictEqual(rgba[unclaimed + 3], 0)
})

test('unaligned settlements paint gray on primary claim', () => {
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: 5,
    settlements: [{ id: 'u', x: 1, y: 1, status: 'living', factionId: null }],
    factions: [],
    primaryClaim: { u: [{ x: 1, y: 1 }] },
  })
  assert.ok(rgba)
  const offset = cellOffset(1, 1, 4)
  assert.strictEqual(rgba[offset], FACTION_TERRITORY_UNALIGNED_RGB[0])
  assert.strictEqual(rgba[offset + 1], FACTION_TERRITORY_UNALIGNED_RGB[1])
  assert.strictEqual(rgba[offset + 2], FACTION_TERRITORY_UNALIGNED_RGB[2])
})

test('pre-latch founding faction still paints territory', () => {
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: null,
    settlements: [{ id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-founding-a' }],
    factions: [
      {
        id: 'faction-founding-a',
        capitalSettlementId: 'a',
        settlementIds: ['a'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    primaryClaim: { a: [{ x: 1, y: 1 }] },
  })
  assert.ok(rgba)
  const tint = factionTerritoryRgb('faction-founding-a')
  const offset = cellOffset(1, 1, 4)
  assert.strictEqual(rgba[offset], tint[0])
})

test('pre-latch with no factions paints nothing', () => {
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: null,
    settlements: [{ id: 'a', x: 1, y: 1, status: 'living', factionId: null }],
    factions: [],
    primaryClaim: { a: [{ x: 1, y: 1 }] },
  })
  assert.strictEqual(rgba, null)
})

test('vassal control strength opacity is below capital', () => {
  assert.ok(FACTION_TERRITORY_VASSAL_ALPHA < FACTION_TERRITORY_CAPITAL_ALPHA)
  assert.ok(FACTION_TERRITORY_UNALIGNED_ALPHA < FACTION_TERRITORY_VASSAL_ALPHA)

  const capital = { id: 'a', factionId: 'f1' }
  const vassal = { id: 'b', factionId: 'f1', vassalLiegeSettlementId: 'a' }
  const faction = { id: 'f1', capitalSettlementId: 'a' }
  assert.strictEqual(factionTerritoryControlAlpha(capital, faction), FACTION_TERRITORY_CAPITAL_ALPHA)
  assert.strictEqual(factionTerritoryControlAlpha(vassal, faction), FACTION_TERRITORY_VASSAL_ALPHA)
})

test('overlapping haul-shed geometry does not dual-fill a claimed cell', () => {
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 0, y: 0, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 3, y: 3, status: 'living', factionId: 'faction-b' },
    ],
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 'a',
        settlementIds: ['a'],
        status: 'active',
        emergedEpoch: 1,
      },
      {
        id: 'faction-b',
        capitalSettlementId: 'b',
        settlementIds: ['b'],
        status: 'active',
        emergedEpoch: 2,
      },
    ],
    primaryClaim: {
      a: [{ x: 1, y: 1 }],
      b: [{ x: 2, y: 2 }],
    },
  })
  assert.ok(rgba)
  const aTint = factionTerritoryRgb('faction-a')
  const bTint = factionTerritoryRgb('faction-b')
  const aCell = cellOffset(1, 1, 4)
  const bCell = cellOffset(2, 2, 4)
  assert.strictEqual(rgba[aCell], aTint[0])
  assert.strictEqual(rgba[bCell], bTint[0])
  assert.notStrictEqual(aTint[0], bTint[0])
})
