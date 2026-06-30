import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { NODE_MAP_EDGE_MARGIN } from '../nodePlacementBounds.js'
import {
  measureLandBiomeFractionWithinRadius,
  placeSaltNodes,
  SALT_NODE_LAND_PROXIMITY_RADIUS,
  SALT_NODE_MIN_LAND_FRACTION,
  saltNodeHasSubstantialLandProximity,
} from './placeSaltNodes.js'

const width = 48
const height = 48

/**
 * @param {Array<{ x: number, y: number, value: number, biome?: number }>} hotspots
 * @param {Uint8Array} [biomes]
 */
function makeSaltFixture(hotspots, biomes) {
  const cellCount = width * height
  const salinity = new Float32Array(cellCount)
  const coastNavigability = new Float32Array(cellCount)
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  const biomeGrid = biomes ?? new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)

  for (const { x, y, value, biome } of hotspots) {
    const idx = y * width + x
    salinity[idx] = value
    coastNavigability[idx] = value
    if (biome !== undefined) {
      biomeGrid[idx] = biome
    }
  }

  return {
    elevation,
    salinity,
    coastNavigability,
    biomes: biomeGrid,
    lakes: [],
    width,
    height,
    geographySeed: 42,
    maxNodes: 4,
  }
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {(nx: number, ny: number) => number} biomeAt
 */
function makeBiomeGrid(cx, cy, biomeAt) {
  const biomes = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      biomes[y * width + x] = biomeAt(x, y)
    }
  }
  return biomes
}

/**
 * @param {Array<{ x: number, y: number }>} nodes
 */
function assertNodesRespectMapEdgeMargin(nodes) {
  const margin = NODE_MAP_EDGE_MARGIN
  for (const node of nodes) {
    assert.ok(node.x >= margin)
    assert.ok(node.y >= margin)
    assert.ok(node.x < width - margin)
    assert.ok(node.y < height - margin)
  }
}

test('measureLandBiomeFractionWithinRadius counts a 10-cell disk', () => {
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  const { sampleCount } = measureLandBiomeFractionWithinRadius(
    24,
    24,
    biomes,
    width,
    height,
    SALT_NODE_LAND_PROXIMITY_RADIUS,
  )
  assert.strictEqual(sampleCount, 317)
})

test('saltNodeHasSubstantialLandProximity rejects a lone land hot pixel in open ocean', () => {
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 25] = BIOMES.GRASSLAND

  const { landFraction } = measureLandBiomeFractionWithinRadius(
    24,
    24,
    biomes,
    width,
    height,
    SALT_NODE_LAND_PROXIMITY_RADIUS,
  )
  assert.ok(landFraction < SALT_NODE_MIN_LAND_FRACTION)
  assert.strictEqual(
    saltNodeHasSubstantialLandProximity(24, 24, biomes, width, height),
    false,
  )
})

test('saltNodeHasSubstantialLandProximity accepts shoreline-style half land cover', () => {
  const cx = 24
  const cy = 24
  const biomes = makeBiomeGrid(cx, cy, (x) => (x < cx ? BIOMES.GRASSLAND : BIOMES.OCEAN))

  const { landFraction } = measureLandBiomeFractionWithinRadius(
    cx,
    cy,
    biomes,
    width,
    height,
    SALT_NODE_LAND_PROXIMITY_RADIUS,
  )
  assert.ok(landFraction >= 0.3)
  assert.strictEqual(saltNodeHasSubstantialLandProximity(cx, cy, biomes, width, height), true)
})

test('placeSaltNodes excludes candidates within the map edge margin', () => {
  const nodes = placeSaltNodes(
    makeSaltFixture([
      { x: 2, y: 2, value: 0.95 },
      { x: 24, y: 24, value: 0.8 },
    ]),
  )

  assert.ok(nodes.length > 0)
  assert.strictEqual(nodes.some((node) => node.x === 2 && node.y === 2), false)
  assertNodesRespectMapEdgeMargin(nodes)
})

test('placeSaltNodes rejects open-ocean river corridor nodes surrounded by water', () => {
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.RIVER_CORRIDOR

  const nodes = placeSaltNodes(
    makeSaltFixture([{ x: 24, y: 24, value: 0.95, biome: BIOMES.RIVER_CORRIDOR }], biomes),
  )

  assert.strictEqual(nodes.some((node) => node.x === 24 && node.y === 24), false)
})

test('placeSaltNodes rejects embayed nodes with only a sliver of nearby land', () => {
  const cx = 24
  const cy = 24
  const biomes = makeBiomeGrid(cx, cy, (x, y) => {
    const dx = x - cx
    const dy = y - cy
    if (Math.hypot(dx, dy) > SALT_NODE_LAND_PROXIMITY_RADIUS) {
      return BIOMES.OCEAN
    }
    return dx < -7 ? BIOMES.GRASSLAND : BIOMES.OCEAN
  })

  const { landFraction } = measureLandBiomeFractionWithinRadius(
    cx,
    cy,
    biomes,
    width,
    height,
    SALT_NODE_LAND_PROXIMITY_RADIUS,
  )
  assert.ok(landFraction < SALT_NODE_MIN_LAND_FRACTION)

  const nodes = placeSaltNodes(
    makeSaltFixture([{ x: cx, y: cy, value: 0.95, biome: BIOMES.RIVER_CORRIDOR }], biomes),
  )
  assert.strictEqual(nodes.some((node) => node.x === cx && node.y === cy), false)
})

test('placeSaltNodes keeps coastal candidates with substantial neighboring land', () => {
  const cx = 24
  const cy = 24
  const biomes = makeBiomeGrid(cx, cy, (x) => (x < cx ? BIOMES.GRASSLAND : BIOMES.OCEAN))

  const nodes = placeSaltNodes(
    makeSaltFixture([{ x: cx, y: cy, value: 0.95, biome: BIOMES.RIVER_CORRIDOR }], biomes),
  )

  assert.ok(nodes.some((node) => node.x === cx && node.y === cy))
})
