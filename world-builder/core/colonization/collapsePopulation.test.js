import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import {
  POPULATION_COLLAPSE_CORE_FRACTION,
  collapsePopulation,
  hashPopulationCollapseRaster,
  isHabitablePopulationCell,
} from './collapsePopulation.js'

/** @param {number} cellCount */
function landElevation(cellCount) {
  return new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
}

test('isHabitablePopulationCell rejects ocean elevation and water biomes', () => {
  const elevation = Float32Array.from([SEA_LEVEL + 0.2, SEA_LEVEL - 0.1])
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 2,
      elevation,
      biomes: Uint8Array.from([BIOMES.GRASSLAND, BIOMES.OCEAN]),
    }),
    true,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 1,
      y: 0,
      gridWidth: 2,
      elevation,
      biomes: Uint8Array.from([BIOMES.GRASSLAND, BIOMES.OCEAN]),
    }),
    false,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 1,
      elevation: landElevation(1),
      lakeMask: Uint8Array.from([1]),
    }),
    false,
  )
})

test('collapsePopulation places core fraction at the pin and spreads hinterland by arable', () => {
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 1, y: 1, population: 100, status: 'living' }],
    primaryClaim: {
      s1: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    },
    // (0,1)=1, (2,1)=3 so eastern hinterland gets more density
    arableRaster: Float32Array.from([0, 0, 0, 1, 0, 3, 0, 0, 0]),
    elevation: landElevation(9),
    biomes: new Uint8Array(9).fill(BIOMES.GRASSLAND),
    gridWidth: 3,
    gridHeight: 3,
  })

  const core = Math.floor(100 * POPULATION_COLLAPSE_CORE_FRACTION)
  assert.strictEqual(raster[1 * 3 + 1], core)
  assert.ok(raster[1 * 3 + 2] > raster[1 * 3 + 0])
  const total = raster.reduce((sum, value) => sum + value, 0)
  assert.strictEqual(total, 100)
})

test('collapsePopulation never places people on water cells', () => {
  const elevation = landElevation(9)
  elevation[1 * 3 + 2] = SEA_LEVEL - 0.1
  const biomes = new Uint8Array(9).fill(BIOMES.GRASSLAND)
  biomes[1 * 3 + 0] = BIOMES.OCEAN

  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 1, y: 1, population: 100, status: 'living' }],
    primaryClaim: {
      s1: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 0 },
      ],
    },
    arableRaster: Float32Array.from([0, 5, 0, 5, 0, 5, 0, 0, 0]),
    elevation,
    biomes,
    lakeMask: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 1, 0]),
    gridWidth: 3,
    gridHeight: 3,
  })

  assert.strictEqual(raster[1 * 3 + 0], 0)
  assert.strictEqual(raster[1 * 3 + 2], 0)
  assert.strictEqual(raster[2 * 3 + 1], 0)
  assert.ok(raster[1 * 3 + 1] > 0)
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), 100)
})

test('collapsePopulation keeps hinterland at the pin when no arable land exists', () => {
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 0, y: 0, population: 20, status: 'living' }],
    primaryClaim: {
      s1: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    arableRaster: Float32Array.from([0, 0]),
    elevation: landElevation(2),
    biomes: new Uint8Array(2).fill(BIOMES.GRASSLAND),
    gridWidth: 2,
    gridHeight: 1,
  })

  assert.strictEqual(raster[0], 20)
  assert.strictEqual(raster[1], 0)
})

test('collapsePopulation only writes claimed land cells', () => {
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 0, y: 0, population: 10, status: 'living' }],
    primaryClaim: {
      s1: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    arableRaster: Float32Array.from([1, 1, 1, 1]),
    elevation: landElevation(4),
    biomes: new Uint8Array(4).fill(BIOMES.GRASSLAND),
    gridWidth: 2,
    gridHeight: 2,
  })

  assert.strictEqual(raster[1 * 2 + 1], 0)
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), 10)
})

test('collapsePopulation is deterministic for identical inputs', () => {
  const params = {
    settlements: [{ id: 's1', x: 0, y: 0, population: 40, status: 'living' }],
    primaryClaim: {
      s1: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    },
    arableRaster: Float32Array.from([1, 2, 3, 4]),
    elevation: landElevation(4),
    biomes: new Uint8Array(4).fill(BIOMES.GRASSLAND),
    gridWidth: 2,
    gridHeight: 2,
  }
  const a = collapsePopulation(params)
  const b = collapsePopulation(params)
  assert.strictEqual(hashPopulationCollapseRaster(a), hashPopulationCollapseRaster(b))
})

test('collapsePopulation skips ruins', () => {
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 0, y: 0, population: 0, status: 'ruin' }],
    primaryClaim: { s1: [{ x: 0, y: 0 }] },
    elevation: landElevation(1),
    gridWidth: 1,
    gridHeight: 1,
  })
  assert.strictEqual(raster[0], 0)
})
