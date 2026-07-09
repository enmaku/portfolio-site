import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateLivingSphereConsolidation } from './evaluateLivingSphereConsolidation.js'
import { LIVING_SPHERE_DEFICIT_EPOCHS } from './mergeCounters.js'

function makeDoc() {
  const gridWidth = 10
  const gridHeight = 10
  return {
    geographySeed: 1,
    gridWidth,
    gridHeight,
    fields: { elevation: new Float32Array(gridWidth * gridHeight).fill(0.65) },
    lakeMask: new Uint8Array(gridWidth * gridHeight),
    riverCorridorMask: new Uint8Array(gridWidth * gridHeight),
    biomes: new Uint8Array(gridWidth * gridHeight),
  }
}

test('evaluateLivingSphereConsolidation picks surplus neighbor by travel time and tier', () => {
  const doc = makeDoc()
  const settlements = [
    { id: 'deficit', x: 2, y: 2, tier: 'hamlet', population: 60, status: 'living' },
    { id: 'surplus', x: 3, y: 2, tier: 'village', population: 250, status: 'living' },
  ]
  const candidates = evaluateLivingSphereConsolidation({
    settlements,
    survivalBySettlementId: {
      deficit: { foodSurplus: -3 },
      surplus: { foodSurplus: 5 },
    },
    mergeCounters: {
      deficit: { livingSphereDeficit: LIVING_SPHERE_DEFICIT_EPOCHS },
    },
    colonistSettings: { threeDayHaulDistance: 50 },
    worldDocument: doc,
    roadCellMask: null,
    foundingSettlementId: null,
    alreadyAbsorbedThisEpoch: new Set(),
    alreadySurvivorThisEpoch: new Set(),
  })

  assert.strictEqual(candidates.length, 1)
  assert.strictEqual(candidates[0].survivorSettlementId, 'surplus')
  assert.strictEqual(candidates[0].absorbedSettlementId, 'deficit')
})
