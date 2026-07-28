import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFactionTerritoryOverlayRgba,
  factionTerritoryPaletteIndex,
  factionTerritoryRgb,
  FACTION_TERRITORY_BASELINE_SATURATION_BOOST,
  FACTION_TERRITORY_CLAIM_OUTLINE_RGBA,
  FACTION_TERRITORY_FILL_ALPHA,
  FACTION_TERRITORY_HOVER_SATURATION_BOOST,
  FACTION_TERRITORY_PALETTE,
  FACTION_TERRITORY_UNALIGNED_RGB,
  saturateFactionTerritoryRgb,
  settlementMatchesTerritoryHighlight,
} from './buildFactionTerritoryOverlayRgba.js'

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

function rgbDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
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
  const tint = factionTerritoryRgb('faction-a', [{ id: 'faction-a', emergedEpoch: 1 }])
  assert.strictEqual(rgba[claim], tint[0])
  assert.strictEqual(rgba[claim + 1], tint[1])
  assert.strictEqual(rgba[claim + 3], Math.round(FACTION_TERRITORY_FILL_ALPHA * 255))
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
  assert.strictEqual(rgba[offset + 3], Math.round(FACTION_TERRITORY_FILL_ALPHA * 255))
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
  const tint = factionTerritoryRgb('faction-founding-a', [
    { id: 'faction-founding-a', emergedEpoch: 0 },
  ])
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

test('capital and vassal of the same faction share one solid tint', () => {
  const factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'b'],
      status: 'active',
      emergedEpoch: 1,
    },
  ]
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 6, y: 1, status: 'living', factionId: 'faction-a', vassalLiegeSettlementId: 'a' },
    ],
    factions,
    primaryClaim: {
      a: [{ x: 2, y: 1 }],
      b: [{ x: 5, y: 1 }],
    },
  })
  assert.ok(rgba)
  const tint = factionTerritoryRgb('faction-a', factions)
  const capitalCell = cellOffset(2, 1, 8)
  const vassalCell = cellOffset(5, 1, 8)
  assert.strictEqual(rgba[capitalCell], tint[0])
  assert.strictEqual(rgba[capitalCell + 1], tint[1])
  assert.strictEqual(rgba[capitalCell + 2], tint[2])
  assert.strictEqual(rgba[vassalCell], tint[0])
  assert.strictEqual(rgba[vassalCell + 1], tint[1])
  assert.strictEqual(rgba[vassalCell + 2], tint[2])
  assert.strictEqual(rgba[capitalCell + 3], rgba[vassalCell + 3])
})

test('omits outline between abutting claims of the same faction', () => {
  const factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'b'],
      status: 'active',
      emergedEpoch: 1,
    },
  ]
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 6, y: 1, status: 'living', factionId: 'faction-a' },
    ],
    factions,
    primaryClaim: {
      a: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      b: [
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
    },
  })
  assert.ok(rgba)
  const tint = factionTerritoryRgb('faction-a', factions)
  const aEdge = cellOffset(3, 1, 8)
  const bEdge = cellOffset(4, 1, 8)
  assert.strictEqual(rgba[aEdge], tint[0])
  assert.strictEqual(rgba[aEdge + 1], tint[1])
  assert.strictEqual(rgba[aEdge + 2], tint[2])
  assert.strictEqual(rgba[bEdge], tint[0])
  assert.strictEqual(rgba[bEdge + 1], tint[1])
  assert.strictEqual(rgba[bEdge + 2], tint[2])
  assert.notStrictEqual(rgba[aEdge + 3], FACTION_TERRITORY_CLAIM_OUTLINE_RGBA[3])
})

test('paints outline between abutting claims of different factions', () => {
  const factions = [
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
  ]
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 6, y: 1, status: 'living', factionId: 'faction-b' },
    ],
    factions,
    primaryClaim: {
      a: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      b: [
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
    },
  })
  assert.ok(rgba)
  const aEdge = cellOffset(3, 1, 8)
  const bEdge = cellOffset(4, 1, 8)
  assert.strictEqual(rgba[aEdge], FACTION_TERRITORY_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[aEdge + 3], FACTION_TERRITORY_CLAIM_OUTLINE_RGBA[3])
  assert.strictEqual(rgba[bEdge], FACTION_TERRITORY_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[bEdge + 3], FACTION_TERRITORY_CLAIM_OUTLINE_RGBA[3])
})

test('overlapping haul-shed geometry does not dual-fill a claimed cell', () => {
  const factions = [
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
  ]
  const rgba = buildFactionTerritoryOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 0, y: 0, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 3, y: 3, status: 'living', factionId: 'faction-b' },
    ],
    factions,
    primaryClaim: {
      a: [{ x: 1, y: 1 }],
      b: [{ x: 2, y: 2 }],
    },
  })
  assert.ok(rgba)
  const aTint = factionTerritoryRgb('faction-a', factions)
  const bTint = factionTerritoryRgb('faction-b', factions)
  const aCell = cellOffset(1, 1, 4)
  const bCell = cellOffset(2, 2, 4)
  assert.strictEqual(rgba[aCell], aTint[0])
  assert.strictEqual(rgba[bCell], bTint[0])
  assert.notStrictEqual(aTint[0], bTint[0])
})

test('faction palette prefers stored territoryPaletteIndex over emergence order', () => {
  const roster = [
    { id: 'faction-a', emergedEpoch: 0, territoryPaletteIndex: 5 },
    { id: 'faction-b', emergedEpoch: 2, territoryPaletteIndex: 1 },
  ]
  assert.strictEqual(factionTerritoryPaletteIndex('faction-a', roster), 5)
  assert.strictEqual(factionTerritoryPaletteIndex('faction-b', roster), 1)
})

test('faction palette assigns by emergence order and keeps colors when another faction goes extinct', () => {
  const roster = [
    { id: 'faction-a', emergedEpoch: 0 },
    { id: 'faction-b', emergedEpoch: 2 },
    { id: 'faction-c', emergedEpoch: 5 },
  ]
  assert.strictEqual(factionTerritoryPaletteIndex('faction-a', roster), 0)
  assert.strictEqual(factionTerritoryPaletteIndex('faction-b', roster), 1)
  assert.strictEqual(factionTerritoryPaletteIndex('faction-c', roster), 2)
  const before = factionTerritoryRgb('faction-b', roster)
  const afterExtinct = factionTerritoryRgb('faction-b', [
    { id: 'faction-a', emergedEpoch: 0 },
    { id: 'faction-b', emergedEpoch: 2 },
    { id: 'faction-c', emergedEpoch: 5, status: 'extinct' },
  ])
  assert.deepStrictEqual(before, afterExtinct)
})

test('ColorBrewer Set3 twelve faction colors are pairwise distinct in RGB', () => {
  assert.strictEqual(FACTION_TERRITORY_PALETTE.length, 12)
  assert.ok(FACTION_TERRITORY_BASELINE_SATURATION_BOOST < FACTION_TERRITORY_HOVER_SATURATION_BOOST)
  const roster = Array.from({ length: FACTION_TERRITORY_PALETTE.length }, (_, i) => ({
    id: `faction-${i}`,
    emergedEpoch: i,
    territoryPaletteIndex: i,
  }))
  const colors = roster.map((f) => factionTerritoryRgb(f.id, roster))
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      assert.ok(
        rgbDistance(colors[i], colors[j]) >= 28,
        `colors ${i} and ${j} too close: ${rgbDistance(colors[i], colors[j])}`,
      )
    }
  }
})

test('hover highlight saturates only the matched faction claims', () => {
  const factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'b'],
      status: 'active',
      emergedEpoch: 1,
      territoryPaletteIndex: 0,
    },
    {
      id: 'faction-b',
      capitalSettlementId: 'c',
      settlementIds: ['c'],
      status: 'active',
      emergedEpoch: 2,
      territoryPaletteIndex: 1,
    },
  ]
  const worldDocument = {
    gridWidth: 8,
    gridHeight: 8,
    increment3LatchedEpoch: 3,
    settlements: [
      { id: 'a', x: 1, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'b', x: 6, y: 1, status: 'living', factionId: 'faction-a' },
      { id: 'c', x: 4, y: 4, status: 'living', factionId: 'faction-b' },
    ],
    factions,
    primaryClaim: {
      a: [{ x: 2, y: 1 }],
      b: [{ x: 5, y: 1 }],
      c: [{ x: 4, y: 4 }],
    },
  }
  const rgba = buildFactionTerritoryOverlayRgba(worldDocument, {
    highlight: { type: 'faction', factionId: 'faction-a' },
  })
  assert.ok(rgba)
  const baseA = factionTerritoryRgb('faction-a', factions)
  const satA = saturateFactionTerritoryRgb(baseA)
  const baseB = factionTerritoryRgb('faction-b', factions)
  const aCell = cellOffset(2, 1, 8)
  const bCell = cellOffset(5, 1, 8)
  const cCell = cellOffset(4, 4, 8)
  assert.strictEqual(rgba[aCell], satA[0])
  assert.strictEqual(rgba[aCell + 1], satA[1])
  assert.strictEqual(rgba[bCell], satA[0])
  assert.strictEqual(rgba[cCell], baseB[0])
  assert.notDeepEqual(satA, baseA)
  assert.ok(
    settlementMatchesTerritoryHighlight(worldDocument.settlements[0], {
      type: 'faction',
      factionId: 'faction-a',
    }),
  )
  assert.ok(
    !settlementMatchesTerritoryHighlight(worldDocument.settlements[2], {
      type: 'faction',
      factionId: 'faction-a',
    }),
  )
})

test('unaligned hover highlight darkens only that settlement', () => {
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    increment3LatchedEpoch: 5,
    settlements: [
      { id: 'u1', x: 0, y: 0, status: 'living', factionId: null },
      { id: 'u2', x: 3, y: 3, status: 'living', factionId: null },
    ],
    factions: [{ id: 'faction-a', status: 'active', emergedEpoch: 0 }],
    primaryClaim: {
      u1: [{ x: 0, y: 0 }],
      u2: [{ x: 3, y: 3 }],
    },
  }
  const rgba = buildFactionTerritoryOverlayRgba(worldDocument, {
    highlight: { type: 'unaligned', settlementId: 'u1' },
  })
  assert.ok(rgba)
  const highlighted = saturateFactionTerritoryRgb([...FACTION_TERRITORY_UNALIGNED_RGB])
  const u1 = cellOffset(0, 0, 4)
  const u2 = cellOffset(3, 3, 4)
  assert.strictEqual(rgba[u1], highlighted[0])
  assert.ok(highlighted[0] < FACTION_TERRITORY_UNALIGNED_RGB[0])
  assert.strictEqual(rgba[u2], FACTION_TERRITORY_UNALIGNED_RGB[0])
})
