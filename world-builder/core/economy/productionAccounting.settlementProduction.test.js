import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BASE_METALS_LB_PER_PRODUCTIVITY_UNIT,
  COPPER_LB_PER_EXTRACTION,
  DIAMOND_GEMS_PER_EXTRACTION,
  FOOD_LB_PER_PRODUCTIVITY_UNIT,
  SALT_LB_PER_SCORE,
  TIMBER_LB_PER_PRODUCTIVITY_UNIT,
  computeSettlementProduction,
} from './productionAccounting.js'

const GRID_WIDTH = 3
const CLAIMED = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
]

function indexOf(x, y) {
  return y * GRID_WIDTH + x
}

test('grain converts arable productivity times yield modifier on the food scale', () => {
  const arable = new Float32Array(9)
  arable[indexOf(0, 0)] = 2
  arable[indexOf(1, 0)] = 1
  const bountiful = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    arableRaster: arable,
    yieldModifier: 'bountiful',
  })
  assert.strictEqual(bountiful.amounts.grain, 3 * 1.3 * FOOD_LB_PER_PRODUCTIVITY_UNIT)
})

test('fish converts precomputed productivity on the same food scale', () => {
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    fishProductivity: 2.5,
  })
  assert.strictEqual(production.amounts.fish, 2.5 * FOOD_LB_PER_PRODUCTIVITY_UNIT)
})

test('timber and base metals convert with their catalog constants, no yield modifier', () => {
  const timber = new Float32Array(9)
  timber[indexOf(0, 0)] = 3
  const metals = new Float32Array(9)
  metals[indexOf(1, 0)] = 4
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    timberRaster: timber,
    metalsRaster: metals,
    yieldModifier: 'bountiful',
  })
  assert.strictEqual(production.amounts.timber, 3 * TIMBER_LB_PER_PRODUCTIVITY_UNIT)
  assert.strictEqual(production.amounts.baseMetals, 4 * BASE_METALS_LB_PER_PRODUCTIVITY_UNIT)
})

test('salt pins yield score times constant only when inside the claim', () => {
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    saltNodes: [
      { id: 'salt-in', x: 1, y: 0, score: 2 },
      { id: 'salt-out', x: 2, y: 0, score: 9 },
    ],
  })
  assert.strictEqual(production.amounts.salt, 2 * SALT_LB_PER_SCORE)
})

test('typed deposits extract one unit per claimed pin; unclaimed pins contribute nothing', () => {
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    metalNodes: [
      { id: 'm-copper', x: 0, y: 0, score: 1, kind: 'copper' },
      { id: 'm-diamond', x: 1, y: 0, score: 1, kind: 'diamond' },
      { id: 'm-gold-out', x: 2, y: 0, score: 1, kind: 'gold' },
    ],
  })
  assert.strictEqual(production.amounts.copper, COPPER_LB_PER_EXTRACTION)
  assert.strictEqual(production.amounts.diamonds, DIAMOND_GEMS_PER_EXTRACTION)
  assert.strictEqual(production.amounts.gold, 0)
})

test('accounting stays exclusive to primary-claim cells', () => {
  const arable = new Float32Array(9)
  arable[indexOf(0, 0)] = 5
  arable[indexOf(2, 0)] = 100
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: CLAIMED,
    gridWidth: GRID_WIDTH,
    arableRaster: arable,
  })
  assert.strictEqual(production.amounts.grain, 5 * FOOD_LB_PER_PRODUCTIVITY_UNIT)
})

test('empty claim produces nothing', () => {
  const arable = new Float32Array(9).fill(3)
  const production = computeSettlementProduction({
    settlementId: 's1',
    claimedCells: [],
    gridWidth: GRID_WIDTH,
    arableRaster: arable,
    saltNodes: [{ id: 'salt', x: 0, y: 0, score: 5 }],
    metalNodes: [{ id: 'm', x: 0, y: 0, score: 1, kind: 'gold' }],
  })
  assert.strictEqual(production.amounts.grain, 0)
  assert.strictEqual(production.amounts.salt, 0)
  assert.strictEqual(production.amounts.gold, 0)
})
