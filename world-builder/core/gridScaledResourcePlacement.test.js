import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from './biomeIds.js'
import { runFullDerivedGeographyPipeline } from './derivedGeographyPipeline.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'
import { placeMetalNodes } from './resources/placeMetalNodes.js'
import { placeSaltNodes } from './resources/placeSaltNodes.js'
import { strategicResourceNodeSpacingForGrid } from './resourcePlacementScaling.js'

/**
 * @param {number} gridSize
 * @param {Array<{ x: number, y: number, value: number }>} peaks
 */
function makeMetalPlacementFixture(gridSize, peaks) {
  const cellCount = gridSize * gridSize
  const metalsRaster = new Float32Array(cellCount)
  for (const { x, y, value } of peaks) {
    metalsRaster[y * gridSize + x] = value
  }
  return {
    metalsRaster,
    elevation: new Float32Array(cellCount).fill(SEA_LEVEL + 0.4),
    width: gridSize,
    height: gridSize,
    geographySeed: 7,
    maxNodes: 8,
  }
}

/**
 * @param {Array<{ x: number, y: number }>} nodes
 * @param {number} gridSize
 */
function assertNodeSpacing(nodes, gridSize) {
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const distance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      assert.ok(
        distance >= minSpacing,
        `nodes ${i} and ${j} are only ${distance} cells apart (min ${minSpacing})`,
      )
    }
  }
}

test('placeMetalNodes enforces grid-scaled spacing at 256²', () => {
  const gridSize = 256
  const anchor = gridSize / 4
  const closeOffset = Math.round(12 * (gridSize / 256))
  const nodes = placeMetalNodes(
    makeMetalPlacementFixture(gridSize, [
      { x: anchor, y: anchor, value: 0.95 },
      { x: anchor + closeOffset, y: anchor, value: 0.9 },
      { x: anchor + 80, y: anchor + 80, value: 0.85 },
    ]),
  )

  assert.ok(nodes.length >= 2)
  assertNodeSpacing(nodes, gridSize)
})

test('placeMetalNodes enforces grid-scaled spacing at 1024²', () => {
  const gridSize = 1024
  const anchor = gridSize / 4
  const closeOffset = Math.round(12 * (gridSize / 256))
  const nodes = placeMetalNodes(
    makeMetalPlacementFixture(gridSize, [
      { x: anchor, y: anchor, value: 0.95 },
      { x: anchor + closeOffset, y: anchor, value: 0.9 },
      { x: anchor + 320, y: anchor + 320, value: 0.85 },
    ]),
  )

  assert.ok(nodes.length >= 2)
  assertNodeSpacing(nodes, gridSize)
})

/**
 * @param {number} gridSize
 */
function makeSaltSpacingFixture(gridSize) {
  const cellCount = gridSize * gridSize
  const salinity = new Float32Array(cellCount)
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  const anchor = Math.floor(gridSize / 2)
  const closeOffset = Math.round(8 * (gridSize / 256))

  for (const x of [anchor, anchor + closeOffset, anchor + 96 * (gridSize / 256)]) {
    salinity[anchor * gridSize + x] = 0.95
    elevation[anchor * gridSize + x] = SEA_LEVEL + 0.05
    biomes[anchor * gridSize + x] = BIOMES.RIVER_CORRIDOR
  }

  return {
    elevation,
    salinity,
    biomes,
    lakes: [],
    width: gridSize,
    height: gridSize,
    geographySeed: 42,
    maxNodes: 8,
  }
}

test('placeSaltNodes enforces grid-scaled spacing at 256²', () => {
  const nodes = placeSaltNodes(makeSaltSpacingFixture(256))
  assert.ok(nodes.length > 0)
  assertNodeSpacing(nodes, 256)
})

test('placeSaltNodes enforces grid-scaled spacing at 1024²', () => {
  const nodes = placeSaltNodes(makeSaltSpacingFixture(1024))
  assert.ok(nodes.length > 0)
  assertNodeSpacing(nodes, 1024)
})

test('runFullDerivedGeographyPipeline applies configured arable minimum productivity at 256²', () => {
  const threshold = 0.35
  const doc = runFullDerivedGeographyPipeline({
    geographySeed: 12345,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: threshold,
    },
  })

  assert.ok(doc.arableRaster)
  for (let i = 0; i < doc.arableRaster.length; i += 1) {
    const value = doc.arableRaster[i]
    assert.ok(value === 0 || value > threshold)
  }
})

test('runFullDerivedGeographyPipeline applies configured arable minimum productivity at 1024²', () => {
  const threshold = 0.35
  const doc = runFullDerivedGeographyPipeline({
    geographySeed: 12345,
    prevailingWindDegrees: 90,
    width: 1024,
    height: 1024,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: threshold,
    },
  })

  assert.ok(doc.arableRaster)
  for (let i = 0; i < doc.arableRaster.length; i += 1) {
    const value = doc.arableRaster[i]
    assert.ok(value === 0 || value > threshold)
  }
})

test('runFullDerivedGeographyPipeline arable threshold matches generation default at 256²', () => {
  const withDefault = runFullDerivedGeographyPipeline({
    geographySeed: 777,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
  })
  const withExplicit = runFullDerivedGeographyPipeline({
    geographySeed: 777,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: DEFAULT_WORLD_GENERATION_OPTIONS.arableMinimumProductivity,
    },
  })

  assert.deepStrictEqual(withDefault.arableRaster, withExplicit.arableRaster)
})

test('runFullDerivedGeographyPipeline arable threshold matches generation default at 1024²', () => {
  const withDefault = runFullDerivedGeographyPipeline({
    geographySeed: 777,
    prevailingWindDegrees: 90,
    width: 1024,
    height: 1024,
  })
  const withExplicit = runFullDerivedGeographyPipeline({
    geographySeed: 777,
    prevailingWindDegrees: 90,
    width: 1024,
    height: 1024,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: DEFAULT_WORLD_GENERATION_OPTIONS.arableMinimumProductivity,
    },
  })

  assert.deepStrictEqual(withDefault.arableRaster, withExplicit.arableRaster)
})

test('runFullDerivedGeographyPipeline higher arable threshold yields fewer productive cells at 256²', () => {
  const lowThreshold = runFullDerivedGeographyPipeline({
    geographySeed: 4242,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: 0.1,
    },
  })
  const highThreshold = runFullDerivedGeographyPipeline({
    geographySeed: 4242,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      arableMinimumProductivity: 0.45,
    },
  })

  const countNonZero = (/** @type {Float32Array} */ raster) => {
    let count = 0
    for (let i = 0; i < raster.length; i += 1) {
      if (raster[i] > 0) count += 1
    }
    return count
  }

  assert.ok(countNonZero(highThreshold.arableRaster) < countNonZero(lowThreshold.arableRaster))
})
