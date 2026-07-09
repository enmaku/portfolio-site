import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyEpochStep } from './applyEpochStep.js'
import { applyColonizationEpoch } from './applyColonizationEpoch.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { OUTPOST_REABSORPTION_STAGNATION_EPOCHS } from './mergeCounters.js'

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
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 5 ? 1 : 0)),
  }
}

function commitRunningSlice() {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 1 }
  slice.colonistSettings.startingPopulation = 20
  slice.colonistSettings.threeDayHaulDistance = 2
  return beginColonizationCommit(slice, richGeographyDoc())
}

test('applyEpochStep advances epoch by one', () => {
  const running = commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  const next = applyEpochStep(running, richGeographyDoc())

  assert.strictEqual(next.epoch, 1)
  assert.ok(Object.keys(next.primaryClaim).length > 0)
})

test('applyEpochStep matches applyColonizationEpoch including merge phase', () => {
  const running = commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  const origin = running.settlements.find((settlement) => settlement.status === 'living')
  assert.ok(origin)
  running.settlements.push({
    id: 'daughter',
    status: 'living',
    tier: 'outpost',
    population: 25,
    originSettlementId: origin.id,
    x: 3,
    y: 3,
  })
  running.mergeCounters = {
    daughter: { outpostStagnation: OUTPOST_REABSORPTION_STAGNATION_EPOCHS },
  }

  const doc = richGeographyDoc()
  const fromEpoch = applyColonizationEpoch(running, doc)
  const fromStep = applyEpochStep(running, doc)

  assert.strictEqual(fromStep.epoch, fromEpoch.slice.epoch)
  assert.deepEqual(
    fromStep.settlements.map((settlement) => ({
      id: settlement.id,
      status: settlement.status,
      population: settlement.population,
    })),
    fromEpoch.slice.settlements.map((settlement) => ({
      id: settlement.id,
      status: settlement.status,
      population: settlement.population,
    })),
  )
  assert.deepEqual(
    fromStep.historyLog.map((entry) => entry.kind),
    fromEpoch.slice.historyLog.map((entry) => entry.kind),
  )
})

test('applyEpochStep remains available indefinitely with no auto-stop', () => {
  let current = commitRunningSlice()
  const doc = richGeographyDoc()
  for (let i = 0; i < 5; i += 1) {
    current = applyEpochStep(current, doc)
  }
  assert.strictEqual(current.epoch, 5)
  assert.strictEqual(current.colonizationPhase, 'running')
})
