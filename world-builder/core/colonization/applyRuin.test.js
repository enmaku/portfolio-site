import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyColonizationEpoch } from './applyColonizationEpoch.js'
import { applyEpochStep } from './runColonizationEpochStep.js'
import { applyRuinTransitions } from './applyRuin.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

test('applyRuinTransitions converts population at or below floor to ruin and releases claims', () => {
  const zero = applyRuinTransitions({
    settlements: [{ id: 's1', x: 1, y: 1, population: 0, status: 'living', tier: null }],
    primaryClaim: { s1: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
    historyLog: [{ kind: 'founding', epoch: 0 }],
    epoch: 3,
  })

  assert.strictEqual(zero.settlements[0].status, 'ruin')
  assert.strictEqual(zero.settlements[0].population, 0)
  assert.deepStrictEqual(zero.primaryClaim, {})
  assert.strictEqual(zero.historyLog.at(-1)?.kind, 'settlement_abandoned')
  assert.strictEqual(zero.historyLog.at(-1)?.epoch, 3)
  assert.strictEqual(zero.events[0].kind, 'settlement_abandoned')
  assert.strictEqual(zero.events[0].settlementId, 's1')

  const atFloor = applyRuinTransitions({
    settlements: [{ id: 's2', x: 2, y: 2, population: 10, status: 'living', tier: 'hamlet' }],
    primaryClaim: { s2: [{ x: 2, y: 2 }] },
    historyLog: [],
    epoch: 4,
  })
  assert.strictEqual(atFloor.settlements[0].status, 'ruin')
  assert.strictEqual(atFloor.settlements[0].population, 0)
  assert.deepStrictEqual(atFloor.primaryClaim, {})

  const aboveFloor = applyRuinTransitions({
    settlements: [{ id: 's3', x: 3, y: 3, population: 11, status: 'living', tier: 'hamlet' }],
    primaryClaim: { s3: [{ x: 3, y: 3 }] },
    historyLog: [],
    epoch: 5,
  })
  assert.strictEqual(aboveFloor.settlements[0].status, 'living')
  assert.strictEqual(aboveFloor.settlements[0].population, 11)
  assert.deepStrictEqual(aboveFloor.primaryClaim, { s3: [{ x: 3, y: 3 }] })
  assert.strictEqual(aboveFloor.events.length, 0)
})

function dryGeographyDoc() {
  const cellCount = 16
  return {
    geographySeed: 1,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(1),
    timberRaster: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.DESERT),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
  }
}

test('applyColonizationEpoch ruins waterless settlements and keeps epoch step available', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 1 }
  slice.colonistSettings.startingPopulation = 50
  slice.colonistSettings.threeDayHaulDistance = 1

  // Commit with water so we start living, then dry the map for the tick.
  const wet = dryGeographyDoc()
  wet.riverCorridorMask[1 * 4 + 1] = 1
  wet.biomes.fill(BIOMES.GRASSLAND)
  wet.fields.rainfall.fill(0.6)
  let running = await beginColonizationCommit(slice, wet)
  assert.strictEqual(running.settlements[0].status, 'living')

  const dry = dryGeographyDoc()
  const { slice: next, events } = await applyColonizationEpoch(running, dry)
  assert.strictEqual(next.settlements[0].status, 'ruin')
  assert.strictEqual(next.settlements[0].population, 0)
  assert.deepStrictEqual(next.primaryClaim, {})
  assert.ok(events.some((event) => event.kind === 'settlement_abandoned'))
  assert.ok(next.historyLog.some((entry) => entry.kind === 'settlement_abandoned'))

  const stepped = await applyEpochStep(next, dry)
  assert.strictEqual(stepped.colonizationPhase, 'running')
  assert.ok(stepped.epoch > next.epoch)
})
