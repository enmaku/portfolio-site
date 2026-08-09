import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../biomeIds.js'
import {
  evaluateFirstViableCorridorCandidate,
  isSettlementFoundingSpacingSatisfied,
} from './evaluateCorridorFounding.js'

/**
 * All-land world where a food-rich parent at (1,1) can supply a salt-only candidate
 * at (6,1) over a land link. Every land cell is well-viable (freshwater everywhere).
 *
 * @param {{ freshwater?: boolean, salt?: boolean }} [options]
 */
function makeTradeWorld(options = {}) {
  const freshwater = options.freshwater !== false
  const salt = options.salt !== false
  const width = 8
  const height = 3
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x <= 2; x += 1) {
      arableRaster[y * width + x] = 5
    }
  }
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster,
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.55),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(freshwater ? 0.6 : 0),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(freshwater ? BIOMES.GRASSLAND : BIOMES.DESERT),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    saltNodes: salt ? [{ x: 6, y: 1, score: 1 }] : [],
    metalNodes: [],
  }
}

const TRADE_COLONIST_SETTINGS = {
  threeDayHaulDistance: 12,
  startingPopulation: 100,
  yieldModifier: 'typical',
}

const SALT_TOWN_CANDIDATES = [
  { x: 6, y: 1, node: { x: 6, y: 1, primaryType: 'salt_pan', tags: {}, exhausted: false } },
]

function makeWorldDocument() {
  return {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: Float32Array.from([0, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0]),
    timberRaster: new Float32Array(16).fill(1),
    movementCost: new Float32Array(16).fill(1),
    fields: {
      elevation: new Float32Array(16).fill(0.55),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.6),
      drainage: new Float32Array(16).fill(0.2),
      salinity: new Float32Array(16).fill(0.1),
    },
    biomes: new Uint8Array(16).fill(3),
    lakeMask: new Uint8Array(16),
    riverCorridorMask: Uint8Array.from({ length: 16 }, (_, index) => (index === 6 ? 1 : 0)),
    saltNodes: [],
  }
}

test('evaluateFirstViableCorridorCandidate tries later corridor candidates after an earlier rejection', () => {
  const candidates = [
    {
      x: 1,
      y: 1,
      node: { x: 1, y: 1, primaryType: 'surplus_basin', tags: {}, exhausted: false },
    },
    {
      x: 2,
      y: 1,
      node: { x: 2, y: 1, primaryType: 'haul_junction', tags: {}, exhausted: false },
    },
  ]
  const worldDocument = makeWorldDocument()

  const result = evaluateFirstViableCorridorCandidate(
    candidates,
    [
      { id: 'origin', x: 0, y: 0, status: 'living' },
      { id: 'occupied', x: 1, y: 1, status: 'living' },
    ],
    {
      threeDayHaulDistance: 3,
      startingPopulation: 50,
      yieldModifier: 'typical',
    },
    worldDocument,
    [],
  )

  assert.ok(result && 'candidate' in result)
  assert.strictEqual(result.candidate.x, 2)
  assert.strictEqual(result.candidate.y, 1)
})

test('salt-only candidate is viable when parent food exports cover the shortfall over the link', () => {
  const worldDocument = makeTradeWorld()
  const result = evaluateFirstViableCorridorCandidate(
    SALT_TOWN_CANDIDATES,
    [{ id: 'origin', x: 1, y: 1, population: 100, status: 'living' }],
    TRADE_COLONIST_SETTINGS,
    worldDocument,
    [],
    'land',
    'origin',
  )
  assert.ok(result && 'candidate' in result)
  assert.strictEqual(result.candidate.x, 6)
  assert.strictEqual(result.candidate.y, 1)
})

test('salt-only candidate is rejected without a founding parent to import food from', () => {
  const worldDocument = makeTradeWorld()
  const result = evaluateFirstViableCorridorCandidate(
    SALT_TOWN_CANDIDATES,
    [{ id: 'origin', x: 1, y: 1, population: 100, status: 'living' }],
    TRADE_COLONIST_SETTINGS,
    worldDocument,
    [],
    'land',
    undefined,
  )
  assert.ok(result && 'rejected' in result)
})

test('freshwater failure rejects founding even when trade could cover food', () => {
  const worldDocument = makeTradeWorld({ freshwater: false })
  const result = evaluateFirstViableCorridorCandidate(
    SALT_TOWN_CANDIDATES,
    [{ id: 'origin', x: 1, y: 1, population: 100, status: 'living' }],
    TRADE_COLONIST_SETTINGS,
    worldDocument,
    [],
    'land',
    'origin',
  )
  assert.ok(!(result && 'candidate' in result))
})

test('trade-aware founding is deterministic for identical inputs', () => {
  const evaluate = () =>
    evaluateFirstViableCorridorCandidate(
      SALT_TOWN_CANDIDATES,
      [{ id: 'origin', x: 1, y: 1, population: 100, status: 'living' }],
      TRADE_COLONIST_SETTINGS,
      makeTradeWorld(),
      [],
      'land',
      'origin',
    )
  assert.deepStrictEqual(evaluate(), evaluate())
})

test('isSettlementFoundingSpacingSatisfied rejects pins within one day of an existing settlement', () => {
  const worldDocument = makeWorldDocument()
  const colonistSettings = { threeDayHaulDistance: 6 }

  assert.strictEqual(
    isSettlementFoundingSpacingSatisfied({
      settlements: [{ id: 'origin', x: 1, y: 1, status: 'living' }],
      x: 2,
      y: 1,
      colonistSettings,
      worldDocument,
    }),
    false,
  )

  assert.strictEqual(
    isSettlementFoundingSpacingSatisfied({
      settlements: [{ id: 'origin', x: 1, y: 1, status: 'living' }],
      x: 3,
      y: 1,
      colonistSettings,
      worldDocument,
    }),
    true,
  )
})

test('isSettlementFoundingSpacingSatisfied ignores ruins for travel-time spacing', () => {
  const worldDocument = makeWorldDocument()

  assert.strictEqual(
    isSettlementFoundingSpacingSatisfied({
      settlements: [{ id: 'ruin', x: 2, y: 1, status: 'ruin' }],
      x: 2,
      y: 1,
      colonistSettings: { threeDayHaulDistance: 6 },
      worldDocument,
    }),
    false,
  )
})
