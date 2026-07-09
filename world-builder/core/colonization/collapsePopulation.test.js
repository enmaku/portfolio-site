import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import {
  POPULATION_COLLAPSE_CORE_FRACTION,
  collapsePopulation,
  collapsePopulationAsync,
  hashPopulationCollapseRaster,
  isHabitablePopulationCell,
} from './collapsePopulation.js'

/** @param {number} cellCount */
function landElevation(cellCount) {
  return new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
}

/**
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number }} pin
 */
function fullClaim(width, height, pin) {
  /** @type {Array<{ x: number, y: number }>} */
  const cells = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y })
    }
  }
  return { s1: cells, pin }
}

test('isHabitablePopulationCell is fail-closed without elevation', () => {
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 1,
      elevation: null,
    }),
    false,
  )
})

test('isHabitablePopulationCell rejects ocean, lakes, and river channels', () => {
  const elevation = landElevation(4)
  elevation[1] = SEA_LEVEL - 0.1
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 1,
      y: 0,
      gridWidth: 2,
      elevation,
      biomes: Uint8Array.from([BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    }),
    false,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 2,
      elevation: landElevation(2),
      lakeMask: Uint8Array.from([1, 0]),
    }),
    false,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 2,
      elevation: landElevation(2),
      riverCorridorMask: Uint8Array.from([1, 0]),
    }),
    false,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 0,
      y: 0,
      gridWidth: 2,
      elevation: landElevation(2),
      biomes: Uint8Array.from([BIOMES.FRESHWATER_LAKE, BIOMES.GRASSLAND]),
    }),
    false,
  )
  assert.strictEqual(
    isHabitablePopulationCell({
      x: 1,
      y: 0,
      gridWidth: 2,
      elevation: landElevation(2),
      biomes: Uint8Array.from([BIOMES.FRESHWATER_LAKE, BIOMES.GRASSLAND]),
    }),
    true,
  )
})

test('collapsePopulation never places people on water cells', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const elevation = landElevation(cellCount)
  elevation[2 * width + 4] = SEA_LEVEL - 0.1
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  biomes[2 * width + 0] = BIOMES.OCEAN
  const lakeMask = new Uint8Array(cellCount)
  lakeMask[0 * width + 2] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[4 * width + 2] = 1
  const arableRaster = new Float32Array(cellCount).fill(1)

  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 2, y: 2, population: 100, status: 'living' }],
    primaryClaim: fullClaim(width, height, { x: 2, y: 2 }),
    arableRaster,
    elevation,
    biomes,
    lakeMask,
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    geographySeed: 7,
    epoch: 0,
  })

  assert.strictEqual(raster[2 * width + 4], 0)
  assert.strictEqual(raster[2 * width + 0], 0)
  assert.strictEqual(raster[0 * width + 2], 0)
  assert.strictEqual(raster[4 * width + 2], 0)
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), 100)
})

test('collapsePopulation places urban majority in the core cluster', () => {
  const width = 7
  const height = 7
  const cellCount = width * height
  const pin = { x: 3, y: 3 }
  const raster = collapsePopulation({
    settlements: [{ id: 's1', ...pin, population: 100, status: 'living' }],
    primaryClaim: fullClaim(width, height, pin),
    arableRaster: new Float32Array(cellCount).fill(1),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 11,
    epoch: 0,
  })

  let urban = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      urban += raster[(pin.y + dy) * width + (pin.x + dx)]
    }
  }
  assert.ok(urban >= Math.floor(100 * POPULATION_COLLAPSE_CORE_FRACTION))
  assert.ok(urban / 100 >= 0.75)
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), 100)
})

test('collapsePopulation scatters hinterland instead of filling the claim', () => {
  const width = 25
  const height = 25
  const cellCount = width * height
  const pin = { x: 12, y: 12 }
  const population = 100
  const raster = collapsePopulation({
    settlements: [{ id: 's1', ...pin, population, status: 'living' }],
    primaryClaim: fullClaim(width, height, pin),
    arableRaster: new Float32Array(cellCount).fill(1),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 99,
    epoch: 3,
  })

  let occupied = 0
  let domainArable = 0
  for (let i = 0; i < cellCount; i += 1) {
    if (raster[i] >= 1) occupied += 1
    domainArable += 1
  }
  assert.ok(occupied < domainArable / 2)
  assert.ok(occupied <= population)
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), population)
})

test('collapsePopulation totals match settlement population', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 2, y: 2, population: 47, status: 'living' }],
    primaryClaim: fullClaim(width, height, { x: 2, y: 2 }),
    arableRaster: new Float32Array(cellCount).fill(0.5),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 3,
    epoch: 1,
  })
  assert.strictEqual(raster.reduce((sum, value) => sum + value, 0), 47)
  assert.ok([...raster].every((value) => Number.isInteger(value)))
})

test('collapsePopulation is deterministic for identical inputs', () => {
  const width = 6
  const height = 6
  const cellCount = width * height
  const params = {
    settlements: [{ id: 's1', x: 2, y: 2, population: 80, status: 'living' }],
    primaryClaim: fullClaim(width, height, { x: 2, y: 2 }),
    arableRaster: new Float32Array(cellCount).fill(1),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 42,
    epoch: 5,
  }
  const a = collapsePopulation(params)
  const b = collapsePopulation(params)
  assert.strictEqual(hashPopulationCollapseRaster(a), hashPopulationCollapseRaster(b))
})

test('collapsePopulationAsync matches sync output and emits collapse substeps', async () => {
  const width = 6
  const height = 6
  const cellCount = width * height
  const params = {
    settlements: [{ id: 's1', x: 2, y: 2, population: 80, status: 'living' }],
    primaryClaim: fullClaim(width, height, { x: 2, y: 2 }),
    arableRaster: new Float32Array(cellCount).fill(1),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 42,
    epoch: 5,
  }
  /** @type {string[]} */
  const substepEvents = []
  const asyncRaster = await collapsePopulationAsync(params, {
    yieldToUi: async () => {},
    hooks: {
      onCollapseSubstep(payload) {
        substepEvents.push(`${payload.type}:${payload.substepId}`)
      },
    },
  })
  const syncRaster = collapsePopulation(params)
  assert.strictEqual(hashPopulationCollapseRaster(asyncRaster), hashPopulationCollapseRaster(syncRaster))
  assert.deepStrictEqual(substepEvents, [
    'substep-start:urban',
    'substep-complete:urban',
    'substep-start:hinterland',
    'substep-complete:hinterland',
  ])
})

test('collapsePopulation skips ruins and empty domains', () => {
  const empty = collapsePopulation({
    settlements: [{ id: 's1', x: 0, y: 0, population: 10, status: 'ruin' }],
    primaryClaim: { s1: [{ x: 0, y: 0 }] },
    elevation: landElevation(1),
    gridWidth: 1,
    gridHeight: 1,
    geographySeed: 1,
    epoch: 0,
  })
  assert.strictEqual(empty[0], 0)

  const noLand = collapsePopulation({
    settlements: [{ id: 's1', x: 0, y: 0, population: 10, status: 'living' }],
    primaryClaim: { s1: [{ x: 0, y: 0 }] },
    elevation: null,
    gridWidth: 1,
    gridHeight: 1,
    geographySeed: 1,
    epoch: 0,
  })
  assert.strictEqual(noLand[0], 0)
})

test('collapsePopulation spreads hinterland south of the pin, not only north', () => {
  const width = 51
  const height = 51
  const cellCount = width * height
  const pin = { x: 25, y: 25 }
  /** @type {Array<{ x: number, y: number }>} */
  const cells = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y })
    }
  }

  const raster = collapsePopulation({
    settlements: [{ id: 's1', ...pin, population: 1000, status: 'living' }],
    primaryClaim: { s1: cells },
    arableRaster: new Float32Array(cellCount).fill(1),
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 1,
    epoch: 0,
  })

  let peopleNorth = 0
  let peopleSouth = 0
  let maxSouthDy = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = raster[y * width + x]
      if (value < 1) continue
      if (y < pin.y) {
        peopleNorth += value
      } else if (y > pin.y) {
        peopleSouth += value
        maxSouthDy = Math.max(maxSouthDy, y - pin.y)
      }
    }
  }

  assert.ok(peopleSouth > 0)
  assert.ok(maxSouthDy > 1)
  assert.ok(peopleSouth / peopleNorth > 0.25)
})

test('collapsePopulation parks hinterland in urban cluster when no arable hinterland exists', () => {
  const width = 3
  const height = 3
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount)
  // Only pin has arable; neighbors are land but non-arable.
  arableRaster[1 * width + 1] = 1
  const raster = collapsePopulation({
    settlements: [{ id: 's1', x: 1, y: 1, population: 50, status: 'living' }],
    primaryClaim: fullClaim(width, height, { x: 1, y: 1 }),
    arableRaster,
    elevation: landElevation(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    gridWidth: width,
    gridHeight: height,
    geographySeed: 2,
    epoch: 0,
  })
  let urban = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      urban += raster[(1 + dy) * width + (1 + dx)]
    }
  }
  assert.strictEqual(urban, 50)
})
