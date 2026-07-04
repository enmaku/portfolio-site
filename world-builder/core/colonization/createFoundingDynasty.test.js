import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from './createDefaultColonizationSlice.js'
import {
  createFoundingDynasty,
  landingGeographyHeuristicKey,
} from './createFoundingDynasty.js'

test('landingGeographyHeuristicKey derives from landing biome', () => {
  const key = landingGeographyHeuristicKey(
    { x: 1, y: 0 },
    {
      gridWidth: 2,
      biomes: Uint8Array.from([BIOMES.DESERT, BIOMES.COAST]),
    },
  )
  assert.strictEqual(key, 'coast')
})

test('createFoundingDynasty records dynasty seat with geography-derived label key', () => {
  const dynasty = createFoundingDynasty({
    settlementId: 'settlement-founding-1-2',
    landing: { x: 1, y: 2 },
    worldDocument: {
      gridWidth: 4,
      biomes: new Uint8Array(16).fill(BIOMES.GRASSLAND),
    },
  })

  assert.strictEqual(dynasty.kind, 'dynasty')
  assert.strictEqual(dynasty.role, 'founder')
  assert.strictEqual(dynasty.settlementId, 'settlement-founding-1-2')
  assert.ok(dynasty.labelKey.endsWith('_dynasty'))
  assert.ok(dynasty.labelKey.startsWith('grassland'))
})

test('beginColonizationCommit seeds founding dynasty on the world document slice', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.threeDayHaulDistance = 1

  const cellCount = 16
  const doc = {
    geographySeed: 3,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(1),
    timberRaster: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.SWAMP),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 9 ? 1 : 0)),
  }

  const next = beginColonizationCommit(slice, doc)
  assert.strictEqual(next.notableFigures.length, 1)
  assert.strictEqual(next.notableFigures[0].kind, 'dynasty')
  assert.strictEqual(next.notableFigures[0].role, 'founder')
  assert.strictEqual(next.notableFigures[0].settlementId, next.settlements[0].id)
  assert.ok(next.notableFigures[0].labelKey.endsWith('_dynasty'))

  const resolved = resolveColonizationSlice(next)
  assert.strictEqual(resolved.notableFigures.length, 1)
  assert.strictEqual(resolved.notableFigures[0].kind, 'dynasty')
})
