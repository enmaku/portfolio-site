import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { strategicResourceNodeSpacingForGrid } from '../resourcePlacementScaling.js'
import {
  MIN_ARABLE_LAND_FRACTION,
  computeArableEnvelopeMetrics,
  findSaltNodeLandProximityViolations,
  findStrategicResourceSpacingViolations,
} from './computeResourceValidationMetrics.js'

/**
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {import('../types.js').SaltNode[]} [params.saltNodes]
 * @param {import('../types.js').MetalNode[]} [params.metalNodes]
 * @param {Float32Array} [params.arableRaster]
 * @param {Float32Array} [params.elevation]
 * @param {Uint8Array} [params.biomes]
 */
function makeResourceWorldFixture({
  width,
  height,
  saltNodes = [],
  metalNodes = [],
  arableRaster,
  elevation,
  biomes,
}) {
  const cellCount = width * height
  const resolvedElevation = elevation ?? new Float32Array(cellCount).fill(SEA_LEVEL + 0.3)
  const resolvedBiomes = biomes ?? new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  const resolvedArable =
    arableRaster ?? new Float32Array(cellCount).fill(0.4)

  return {
    geographySeed: 42,
    gridWidth: width,
    gridHeight: height,
    saltNodes,
    metalNodes,
    arableRaster: resolvedArable,
    fields: {
      elevation: resolvedElevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.5),
      drainage: new Float32Array(cellCount).fill(0.5),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: resolvedBiomes,
  }
}

test('computeArableEnvelopeMetrics counts productive land cells from arable raster', () => {
  const width = 10
  const height = 10
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  const arableRaster = new Float32Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    arableRaster[i] = i % 2 === 0 ? 0.5 : 0
  }

  const metrics = computeArableEnvelopeMetrics(arableRaster, elevation, SEA_LEVEL)
  assert.strictEqual(metrics.landCellCount, cellCount)
  assert.strictEqual(metrics.arableCellCount, cellCount / 2)
  assert.strictEqual(metrics.arableLandFraction, 0.5)
})

test('computeArableEnvelopeMetrics excludes ocean cells from land fraction', () => {
  const width = 8
  const height = 4
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  for (let i = 0; i < width; i += 1) {
    elevation[i] = SEA_LEVEL - 0.1
  }
  const arableRaster = new Float32Array(cellCount).fill(0.6)

  const metrics = computeArableEnvelopeMetrics(arableRaster, elevation, SEA_LEVEL)
  assert.strictEqual(metrics.landCellCount, cellCount - width)
  assert.strictEqual(metrics.arableCellCount, cellCount - width)
  assert.strictEqual(metrics.arableLandFraction, 1)
})

test('findSaltNodeLandProximityViolations flags ocean-adjacent salt nodes', () => {
  const width = 48
  const height = 48
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.GRASSLAND

  const violations = findSaltNodeLandProximityViolations(
    [{ id: 'salt-0', x: 24, y: 24, score: 0.9 }],
    biomes,
    width,
    height,
  )

  assert.strictEqual(violations.length, 1)
  assert.deepStrictEqual(violations[0], { x: 24, y: 24, id: 'salt-0' })
})

test('findSaltNodeLandProximityViolations accepts shoreline-style land cover', () => {
  const width = 48
  const height = 48
  const cx = 24
  const cy = 24
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      if (Math.hypot(dx, dy) > 4) continue
      biomes[(cy + dy) * width + (cx + dx)] = BIOMES.GRASSLAND
    }
  }

  const violations = findSaltNodeLandProximityViolations(
    [{ id: 'salt-0', x: cx, y: cy, score: 0.9 }],
    biomes,
    width,
    height,
  )

  assert.deepStrictEqual(violations, [])
})

test('findStrategicResourceSpacingViolations flags nodes closer than grid-scaled spacing', () => {
  const gridSize = 256
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)
  const violations = findStrategicResourceSpacingViolations(
    [
      { id: 'salt-0', x: 40, y: 40, score: 0.9 },
      { id: 'salt-1', x: 40 + minSpacing - 2, y: 40, score: 0.85 },
    ],
    [{ id: 'metal-0', x: 120, y: 120, score: 0.9 }],
    gridSize,
  )

  assert.strictEqual(violations.length, 1)
  assert.strictEqual(violations[0].kind, 'salt')
  assert.ok(violations[0].distance < minSpacing)
})

test('findStrategicResourceSpacingViolations ignores cross-type pairs', () => {
  const gridSize = 256
  const violations = findStrategicResourceSpacingViolations(
    [{ id: 'salt-0', x: 40, y: 40, score: 0.9 }],
    [{ id: 'metal-0', x: 41, y: 40, score: 0.9 }],
    gridSize,
  )

  assert.deepStrictEqual(violations, [])
})

test('MIN_ARABLE_LAND_FRACTION is a small but non-zero envelope floor', () => {
  assert.ok(MIN_ARABLE_LAND_FRACTION > 0)
  assert.ok(MIN_ARABLE_LAND_FRACTION < 0.1)
})

test('makeResourceWorldFixture documents known arable envelope layout', () => {
  const width = 16
  const height = 16
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount)
  for (let i = width; i < cellCount; i += 1) {
    arableRaster[i] = 0.55
  }
  const doc = makeResourceWorldFixture({ width, height, arableRaster })
  const metrics = computeArableEnvelopeMetrics(
    doc.arableRaster,
    doc.fields.elevation,
    SEA_LEVEL,
  )
  assert.ok(metrics.arableLandFraction >= MIN_ARABLE_LAND_FRACTION)
})
