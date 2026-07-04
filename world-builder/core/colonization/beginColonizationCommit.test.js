import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

/**
 * @param {Partial<{
 *   arable: number,
 *   timber: number,
 *   riverAtLanding: boolean,
 *   startingPopulation: number,
 * }>} [options]
 */
function geographyDoc(options = {}) {
  const cellCount = 16
  const arableValue = options.arable ?? 1
  const timberValue = options.timber ?? 1
  const arableRaster = new Float32Array(cellCount).fill(arableValue)
  const timberRaster = new Float32Array(cellCount).fill(timberValue)
  const riverCorridorMask = new Uint8Array(cellCount)
  if (options.riverAtLanding !== false) {
    riverCorridorMask[2 * 4 + 1] = 1
  }

  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
    timberRaster,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
  }
}

test('beginColonizationCommit enters running with founding settlement and tip', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120
  slice.colonistSettings.threeDayHaulDistance = 2

  const next = beginColonizationCommit(slice, geographyDoc())

  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  assert.strictEqual(next.epoch, 0)
  assert.strictEqual(next.settlements.length, 1)
  assert.strictEqual(next.settlements[0].x, 1)
  assert.strictEqual(next.settlements[0].y, 2)
  assert.ok(next.settlements[0].population <= 120)
  assert.ok(next.settlements[0].population > 0)
  assert.ok(next.settlements[0].tier != null)
  assert.strictEqual(next.historyLog.length, 1)
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.strictEqual(next.historyLog[0].epoch, 0)
  assert.strictEqual(next.committedTips.length, 1)
  assert.strictEqual(next.committedTips[0].epoch, 0)
  assert.ok(typeof next.realmId === 'string' && next.realmId.length > 0)
  const settlementId = next.settlements[0].id
  assert.ok(Array.isArray(next.primaryClaim[settlementId]))
  assert.ok(next.primaryClaim[settlementId].some((cell) => cell.x === 1 && cell.y === 2))
  assert.deepStrictEqual(next.committedTips[0].claimMap, next.primaryClaim)
  assert.ok(next.populationCollapseRaster instanceof Float32Array)
  assert.strictEqual(next.populationCollapseRaster.length, 16)
  assert.ok(next.populationCollapseRaster.some((value) => value > 0))
})

test('beginColonizationCommit clamps starting population and keeps founding history as epoch 0 anchor', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 50_000
  slice.colonistSettings.threeDayHaulDistance = 1

  const next = beginColonizationCommit(slice, geographyDoc({ arable: 0.1, timber: 0.1 }))

  assert.ok(next.settlements[0].population < 50_000)
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.strictEqual(next.historyLog[0].epoch, 0)
  assert.strictEqual(next.historyLog[0].colonistSettings.startingPopulation, 50_000)
})

test('beginColonizationCommit non-sustain path when freshwater fails', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120
  slice.colonistSettings.threeDayHaulDistance = 1

  const doc = geographyDoc({ riverAtLanding: false })
  doc.fields.rainfall.fill(0)
  doc.biomes.fill(BIOMES.DESERT)

  const next = beginColonizationCommit(slice, doc)

  assert.strictEqual(next.settlements[0].population, 0)
  assert.strictEqual(next.settlements[0].tier, null)
  assert.strictEqual(next.settlements[0].status, 'ruin')
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.ok(next.historyLog.some((entry) => entry.kind === 'settlement_abandoned'))
})

test('beginColonizationCommit is deterministic for same geography and colonist inputs', () => {
  const build = () => {
    const slice = createDefaultColonizationSlice()
    slice.colonizationPhase = COLONIZATION_PHASE_SETUP
    slice.foundingLanding = { x: 1, y: 2 }
    slice.colonistSettings.startingPopulation = 200
    slice.colonistSettings.threeDayHaulDistance = 2
    return beginColonizationCommit(slice, geographyDoc())
  }

  const a = build()
  const b = build()
  assert.strictEqual(a.settlements[0].population, b.settlements[0].population)
  assert.strictEqual(a.settlements[0].tier, b.settlements[0].tier)
  assert.deepStrictEqual(a.primaryClaim, b.primaryClaim)
})

test('beginColonizationCommit is a no-op without landing or outside setup', () => {
  const noLanding = createDefaultColonizationSlice()
  noLanding.colonizationPhase = COLONIZATION_PHASE_SETUP
  assert.strictEqual(beginColonizationCommit(noLanding, geographyDoc()), noLanding)

  const terrain = createDefaultColonizationSlice()
  terrain.foundingLanding = { x: 0, y: 0 }
  assert.strictEqual(beginColonizationCommit(terrain, geographyDoc()), terrain)
})
