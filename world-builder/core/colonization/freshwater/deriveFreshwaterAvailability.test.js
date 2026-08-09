import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../biomeIds.js'
import {
  FRESHWATER_NONE,
  FRESHWATER_SURFACE,
  FRESHWATER_WELL_VIABLE,
  claimedCellsHaveFreshwater,
  classifyFreshwaterCell,
  deriveFreshwaterAvailability,
} from './deriveFreshwaterAvailability.js'

/**
 * @param {Partial<{
 *   rainfall: number,
 *   drainage: number,
 *   salinity: number,
 *   biome: number,
 *   elevation: number,
 *   lake: boolean,
 *   river: boolean,
 * }>} overrides
 */
function cellSample(overrides = {}) {
  return {
    rainfall: overrides.rainfall ?? 0.5,
    drainage: overrides.drainage ?? 0.3,
    salinity: overrides.salinity ?? 0.2,
    biome: overrides.biome ?? BIOMES.GRASSLAND,
    elevation: overrides.elevation ?? 0.5,
    lake: overrides.lake ?? false,
    river: overrides.river ?? false,
  }
}

test('classifyFreshwaterCell marks river corridor as surface', () => {
  assert.strictEqual(
    classifyFreshwaterCell(cellSample({ river: true, rainfall: 0, drainage: 1, salinity: 1 })),
    FRESHWATER_SURFACE,
  )
})

test('classifyFreshwaterCell marks lake as surface', () => {
  assert.strictEqual(
    classifyFreshwaterCell(cellSample({ lake: true, rainfall: 0, drainage: 1, salinity: 1 })),
    FRESHWATER_SURFACE,
  )
})

test('classifyFreshwaterCell marks coast biome as surface', () => {
  assert.strictEqual(
    classifyFreshwaterCell(cellSample({ biome: BIOMES.COAST, rainfall: 0, drainage: 1, salinity: 1 })),
    FRESHWATER_SURFACE,
  )
})

test('classifyFreshwaterCell marks ocean as none', () => {
  assert.strictEqual(
    classifyFreshwaterCell(cellSample({ biome: BIOMES.OCEAN, elevation: 0.2 })),
    FRESHWATER_NONE,
  )
})

test('classifyFreshwaterCell marks well-viable land when fields pass thresholds', () => {
  assert.strictEqual(
    classifyFreshwaterCell(
      cellSample({
        rainfall: 0.55,
        drainage: 0.25,
        salinity: 0.15,
        biome: BIOMES.GRASSLAND,
      }),
    ),
    FRESHWATER_WELL_VIABLE,
  )
})

test('classifyFreshwaterCell excludes desert from well-viable', () => {
  assert.strictEqual(
    classifyFreshwaterCell(
      cellSample({
        rainfall: 0.55,
        drainage: 0.25,
        salinity: 0.15,
        biome: BIOMES.DESERT,
      }),
    ),
    FRESHWATER_NONE,
  )
})

test('classifyFreshwaterCell excludes scrubland from well-viable', () => {
  assert.strictEqual(
    classifyFreshwaterCell(
      cellSample({
        rainfall: 0.55,
        drainage: 0.25,
        salinity: 0.15,
        biome: BIOMES.SCRUBLAND,
      }),
    ),
    FRESHWATER_NONE,
  )
})

test('classifyFreshwaterCell rejects low rainfall for well-viable', () => {
  assert.strictEqual(
    classifyFreshwaterCell(
      cellSample({
        rainfall: 0.1,
        drainage: 0.25,
        salinity: 0.15,
        biome: BIOMES.GRASSLAND,
      }),
    ),
    FRESHWATER_NONE,
  )
})

test('deriveFreshwaterAvailability raster dimensions match the geography grid', () => {
  const gridWidth = 4
  const gridHeight = 3
  const cellCount = gridWidth * gridHeight
  const classification = deriveFreshwaterAvailability({
    gridWidth,
    gridHeight,
    rainfall: new Float32Array(cellCount).fill(0.6),
    drainage: new Float32Array(cellCount).fill(0.2),
    salinity: new Float32Array(cellCount).fill(0.1),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    elevation: new Float32Array(cellCount).fill(0.5),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
  })

  assert.strictEqual(classification.length, cellCount)
  assert.ok(classification.every((value) => value === FRESHWATER_WELL_VIABLE))
})

test('deriveFreshwaterAvailability prefers surface over well-viable on river cells', () => {
  const gridWidth = 2
  const gridHeight = 1
  const riverCorridorMask = new Uint8Array([1, 0])
  const classification = deriveFreshwaterAvailability({
    gridWidth,
    gridHeight,
    rainfall: new Float32Array([0.6, 0.6]),
    drainage: new Float32Array([0.2, 0.2]),
    salinity: new Float32Array([0.1, 0.1]),
    biomes: new Uint8Array([BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    elevation: new Float32Array([0.5, 0.5]),
    lakeMask: new Uint8Array(2),
    riverCorridorMask,
  })

  assert.strictEqual(classification[0], FRESHWATER_SURFACE)
  assert.strictEqual(classification[1], FRESHWATER_WELL_VIABLE)
})

test('claimedCellsHaveFreshwater uses the same classification as the derive', () => {
  const classification = new Uint8Array([FRESHWATER_NONE, FRESHWATER_WELL_VIABLE, FRESHWATER_NONE])
  assert.strictEqual(
    claimedCellsHaveFreshwater(classification, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ], 3),
    true,
  )
  assert.strictEqual(
    claimedCellsHaveFreshwater(classification, [{ x: 0, y: 0 }, { x: 2, y: 0 }], 3),
    false,
  )
})
