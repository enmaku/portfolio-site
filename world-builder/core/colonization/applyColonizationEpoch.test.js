import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyColonizationEpoch, applyMarginalWealthAttrition, applySurplusPopulationDelta } from './applyColonizationEpoch.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { SETTLEMENT_TIER_THRESHOLDS } from './settlementTierFromPopulation.js'

function richGeographyDoc() {
  const cellCount = 16
  return {
    geographySeed: 7,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 15 ? 1 : 0)),
  }
}

async function commitRunningSlice(startingPopulation = 20) {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 1 }
  slice.colonistSettings.startingPopulation = startingPopulation
  slice.colonistSettings.threeDayHaulDistance = 2
  return beginColonizationCommit(slice, richGeographyDoc())
}

test('applySurplusPopulationDelta grows, stalls, and declines by surplus sign', () => {
  assert.ok(applySurplusPopulationDelta(10, 20, 100) > 10)
  assert.strictEqual(applySurplusPopulationDelta(10, 0, 100), 10)
  assert.ok(applySurplusPopulationDelta(10, -20, 100) < 10)
  assert.strictEqual(applySurplusPopulationDelta(10, 1000, 12), 12)
})

test('applyMarginalWealthAttrition removes half when wealth is at or below zero', () => {
  assert.equal(applyMarginalWealthAttrition(1000, 1), 1000)
  assert.equal(applyMarginalWealthAttrition(1000, 0), 500)
  assert.equal(applyMarginalWealthAttrition(1000, -50), 500)
  assert.equal(applyMarginalWealthAttrition(1, 0), 1)
  assert.equal(applyMarginalWealthAttrition(0, -1), 0)
})

test('applyColonizationEpoch advances epoch and updates population from surplus', async () => {
  const running = await commitRunningSlice(20)
  const doc = richGeographyDoc()
  const before = running.settlements.reduce((sum, s) => sum + (s.population || 0), 0)
  const { slice: next } = await applyColonizationEpoch(running, doc)

  assert.strictEqual(next.epoch, 1)
  const after = next.settlements
    .filter((s) => s.status !== 'ruin')
    .reduce((sum, s) => sum + (s.population || 0), 0)
  assert.ok(after >= before)
  assert.ok(Object.keys(next.primaryClaim).length > 0)
})

test('applyColonizationEpoch clamps population to ceiling across many epochs', async () => {
  let current = await commitRunningSlice(20)
  const doc = richGeographyDoc()
  for (let i = 0; i < 40; i += 1) {
    current = (await applyColonizationEpoch(current, doc)).slice
  }
  const settlement = current.settlements[0]
  assert.ok(settlement.population > 20)
  const tier = settlement.tier
  assert.ok(SETTLEMENT_TIER_THRESHOLDS.some((band) => band.tier === tier))
})

test('applyColonizationEpoch declines without freshwater and does not auto-stop', async () => {
  let current = await commitRunningSlice(20)
  const doc = richGeographyDoc()
  doc.riverCorridorMask.fill(0)
  doc.fields.rainfall.fill(0)
  doc.biomes.fill(BIOMES.DESERT)

  const first = (await applyColonizationEpoch(current, doc)).slice
  assert.strictEqual(first.settlements[0].population, 0)
  const second = (await applyColonizationEpoch(first, doc)).slice
  assert.strictEqual(second.epoch, first.epoch + 1)
  assert.strictEqual(second.settlements[0].population, 0)
})
