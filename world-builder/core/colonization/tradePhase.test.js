import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import {
  createColonizationEpochContext,
  runColonizationEpochClaimsPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
  runColonizationEpochTradePhase,
} from './applyColonizationEpoch.js'
import { applyRuinTransitions } from './applyRuin.js'
import { COLONIZATION_EPOCH_PHASES } from './colonizationEpochSteps.js'
import {
  COLONIZATION_PHASE_RUNNING,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

const GRID_WIDTH = 6
const GRID_HEIGHT = 3

/**
 * Left third (x ≤ 2) is arable; right (x ≥ 3) grows nothing. Freshwater everywhere.
 * A salt pin sits under settlement A; a diamond deposit under settlement B funds its imports.
 */
function tradeFixtureDoc() {
  const cellCount = GRID_WIDTH * GRID_HEIGHT
  const arableRaster = new Float32Array(cellCount)
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      arableRaster[y * GRID_WIDTH + x] = x <= 2 ? 2 : 0
    }
  }
  return {
    geographySeed: 11,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    arableRaster,
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.8),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    saltNodes: [{ id: 'salt-a', x: 1, y: 1, score: 1 }],
    metalNodes: [{ id: 'diamond-b', x: 4, y: 1, score: 1, kind: 'diamond' }],
    coastalNodes: [],
  }
}

/** Same geography, but B owns no tradeable deposit, so it has no credit to fund imports. */
function creditlessFixtureDoc() {
  const doc = tradeFixtureDoc()
  doc.metalNodes = []
  return doc
}

/**
 * @param {object[]} settlements
 * @param {number} haulDistance Claim + trade-route travel-time budget.
 */
function runningSlice(settlements, haulDistance) {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.epoch = 1
  slice.colonistSettings.threeDayHaulDistance = haulDistance
  slice.settlements = settlements
  return slice
}

const FOOD_LESS_SETTLEMENT = { id: 'b', x: 4, y: 1, population: 20, status: 'living', tier: 'outpost' }
const FOOD_RICH_SETTLEMENT = { id: 'a', x: 1, y: 1, population: 50, status: 'living', tier: 'town' }

/**
 * Drive claims → trade → survival → ruin without the network/collapse phases.
 *
 * @param {object[]} settlements
 * @param {object} [doc]
 */
function runTradeSurvivalRuin(settlements, doc = tradeFixtureDoc()) {
  const ctx = createColonizationEpochContext(runningSlice(settlements, 5), doc)
  runColonizationEpochClaimsPhase(ctx)
  runColonizationEpochTradePhase(ctx)
  runColonizationEpochSurvivalPhase(ctx)
  runColonizationEpochRuinPhase(ctx)
  return ctx
}

test('epoch phases run trade after claims and before survival', () => {
  const ids = COLONIZATION_EPOCH_PHASES.map((phase) => phase.id)
  assert.deepStrictEqual(ids, ['network', 'claims', 'trade', 'survival', 'ruin', 'collapse'])
  assert.ok(ids.indexOf('trade') > ids.indexOf('claims'))
  assert.ok(ids.indexOf('trade') < ids.indexOf('survival'))
})

test('same-epoch imports keep a food-less settlement alive that would otherwise ruin', () => {
  // Connected: A's food surplus reaches B's barren claim over the candidate route this epoch.
  const withTrade = runTradeSurvivalRuin([{ ...FOOD_RICH_SETTLEMENT }, { ...FOOD_LESS_SETTLEMENT }])
  const tradedB = withTrade.slice.settlements.find((s) => s.id === 'b')
  assert.strictEqual(tradedB.status, 'living')
  assert.ok(tradedB.population > 0)
  assert.ok(withTrade.slice.lastTradeEpochResult)
  assert.ok(withTrade.slice.lastTradeEpochResult.effectiveDelivered.b.foodLb > 0)

  // Counterfactual: identical barren claim, but B has nothing to trade for credit, so it
  // imports nothing and ruins.
  const strapped = runTradeSurvivalRuin(
    [{ ...FOOD_RICH_SETTLEMENT }, { ...FOOD_LESS_SETTLEMENT }],
    creditlessFixtureDoc(),
  )
  const strappedB = strapped.slice.settlements.find((s) => s.id === 'b')
  assert.strictEqual(strappedB.status, 'ruin')
  assert.strictEqual(strappedB.population, 0)
})

test('a single living settlement skips pairwise trade and leaves route state empty', () => {
  const ctx = createColonizationEpochContext(
    runningSlice([{ ...FOOD_RICH_SETTLEMENT }]),
    tradeFixtureDoc(),
  )
  runColonizationEpochClaimsPhase(ctx)
  runColonizationEpochTradePhase(ctx)

  assert.strictEqual(ctx.slice.lastTradeEpochResult, null)
  assert.strictEqual(ctx.slice.tradeRouteState.activeFlows.length, 0)
  assert.strictEqual(ctx.slice.tradeRouteState.candidates.length, 0)
  assert.deepStrictEqual(ctx.slice.tradeAccounts.obligations, [])
})

test('two living settlements activate pairwise clearing with route flows', () => {
  const ctx = runTradeSurvivalRuin([{ ...FOOD_RICH_SETTLEMENT }, { ...FOOD_LESS_SETTLEMENT }])
  assert.ok(ctx.slice.lastTradeEpochResult)
  assert.ok(ctx.slice.tradeRouteState.candidates.length > 0)
  assert.ok(ctx.slice.tradeRouteState.activeFlows.length > 0)
})

test('ruin cancels incident bilateral obligations and zeroes external credit', () => {
  const result = applyRuinTransitions({
    settlements: [
      { id: 'a', x: 1, y: 1, population: 5, status: 'living', tier: 'outpost' },
      { id: 'b', x: 4, y: 1, population: 0, status: 'living', tier: null },
    ],
    primaryClaim: { a: [{ x: 1, y: 1 }], b: [{ x: 4, y: 1 }] },
    historyLog: [],
    epoch: 4,
    tradeAccounts: {
      obligations: [{ creditorSettlementId: 'a', debtorSettlementId: 'b', amountCp: 500 }],
      balancesBySettlementId: { a: 500, b: -500 },
    },
    externalTradeAccounts: { a: 200, b: 1000 },
  })

  assert.strictEqual(result.settlements.find((s) => s.id === 'b').status, 'ruin')
  assert.deepStrictEqual(result.tradeAccounts.obligations, [])
  assert.deepStrictEqual(result.tradeAccounts.balancesBySettlementId, {})
  assert.strictEqual(result.externalTradeAccounts.b, undefined)
  assert.strictEqual(result.externalTradeAccounts.a, 200)
})
