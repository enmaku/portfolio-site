import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { NODE_MAP_EDGE_MARGIN } from '../nodePlacementBounds.js'
import { strategicResourceNodeSpacingForGrid } from '../resourcePlacementScaling.js'
import { MINERAL_KINDS } from './mineralOccurrence.js'
import { placeMetalNodes } from './placeMetalNodes.js'

const width = 64
const height = 64

function makeMetalsRaster(peaks, gridWidth = width, gridHeight = height) {
  const raster = new Float32Array(gridWidth * gridHeight)
  for (const { x, y, value } of peaks) {
    raster[y * gridWidth + x] = value
  }
  return raster
}

/** Scatter spaced peaks so many candidates survive the spacing filter. */
function makeScatteredRaster(count, gridWidth = 128, gridHeight = 128) {
  const raster = new Float32Array(gridWidth * gridHeight)
  const step = 6
  let placed = 0
  for (let y = step; y < gridHeight - step && placed < count; y += step) {
    for (let x = step; x < gridWidth - step && placed < count; x += step) {
      raster[y * gridWidth + x] = 0.5 + ((placed % 40) / 40) * 0.4
      placed += 1
    }
  }
  return raster
}

function countByKind(nodes) {
  const counts = { copper: 0, silver: 0, gold: 0, diamond: 0 }
  for (const node of nodes) {
    counts[node.kind] += 1
  }
  return counts
}

test('placeMetalNodes returns stable ids and coordinates from raster peaks', () => {
  const metalsRaster = makeMetalsRaster([
    { x: 16, y: 16, value: 0.9 },
    { x: 40, y: 40, value: 0.85 },
  ])
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.3)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width,
    height,
    geographySeed: 42,
    maxNodes: 4,
  })

  assert.ok(nodes.length >= 2)
  assert.strictEqual(nodes[0].id, 'metal-0')
  assert.strictEqual(nodes[1].id, 'metal-1')
  assert.strictEqual(typeof nodes[0].x, 'number')
  assert.strictEqual(typeof nodes[0].y, 'number')
  for (const node of nodes) {
    assert.ok(MINERAL_KINDS.includes(node.kind))
  }
})

test('placeMetalNodes is deterministic for a fixed seed', () => {
  const metalsRaster = makeMetalsRaster([
    { x: 16, y: 16, value: 0.95 },
    { x: 36, y: 20, value: 0.88 },
    { x: 20, y: 44, value: 0.8 },
  ])
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.35)
  const params = {
    metalsRaster,
    elevation,
    width,
    height,
    geographySeed: 12345,
    maxNodes: 3,
  }

  const first = placeMetalNodes(params)
  const second = placeMetalNodes(params)
  assert.deepStrictEqual(first, second)
})

test('placeMetalNodes enforces minimum spacing between selected nodes', () => {
  const metalsRaster = makeMetalsRaster([
    { x: 16, y: 16, value: 0.95 },
    { x: 20, y: 18, value: 0.9 },
    { x: 40, y: 40, value: 0.85 },
  ])
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.4)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width,
    height,
    geographySeed: 7,
    maxNodes: 8,
  })

  const minSpacing = strategicResourceNodeSpacingForGrid(width)
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const distance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      assert.ok(distance >= minSpacing, `nodes ${i} and ${j} are only ${distance} cells apart`)
    }
  }
})

test('placeMetalNodes returns no nodes when maxNodes is zero', () => {
  const metalsRaster = makeMetalsRaster([
    { x: 14, y: 14, value: 0.95 },
    { x: 18, y: 12, value: 0.88 },
  ])
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.35)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width,
    height,
    geographySeed: 42,
    maxNodes: 0,
  })

  assert.deepStrictEqual(nodes, [])
})

test('placeMetalNodes respects maxNodes cap', () => {
  const largeWidth = 64
  const largeHeight = 64
  const peaks = [
    { x: 16, y: 16, value: 0.9 },
    { x: 40, y: 40, value: 0.88 },
    { x: 28, y: 48, value: 0.82 },
  ]
  const raster = new Float32Array(largeWidth * largeHeight)
  for (const { x, y, value } of peaks) {
    raster[y * largeWidth + x] = value
  }
  const elevation = new Float32Array(largeWidth * largeHeight).fill(SEA_LEVEL + 0.5)

  const nodes = placeMetalNodes({
    metalsRaster: raster,
    elevation,
    width: largeWidth,
    height: largeHeight,
    geographySeed: 99,
    maxNodes: 2,
  })

  assert.strictEqual(nodes.length, 2)
})

test('placeMetalNodes excludes candidates within the map edge margin', () => {
  const gridWidth = 48
  const gridHeight = 48
  const metalsRaster = makeMetalsRaster(
    [
      { x: 2, y: 2, value: 0.99 },
      { x: 24, y: 24, value: 0.8 },
    ],
    gridWidth,
    gridHeight,
  )
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 42,
    maxNodes: 4,
  })

  assert.ok(nodes.length > 0)
  assert.strictEqual(nodes.some((node) => node.x === 2 && node.y === 2), false)
  const margin = NODE_MAP_EDGE_MARGIN
  for (const node of nodes) {
    assert.ok(node.x >= margin)
    assert.ok(node.y >= margin)
    assert.ok(node.x < gridWidth - margin)
    assert.ok(node.y < gridHeight - margin)
  }
})

test('placeMetalNodes yields the same typed set for a fixed seed and weights', () => {
  const gridWidth = 128
  const gridHeight = 128
  const metalsRaster = makeScatteredRaster(200, gridWidth, gridHeight)
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)
  const params = {
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 2024,
    maxNodes: 30,
  }

  assert.deepStrictEqual(placeMetalNodes(params), placeMetalNodes(params))
})

test('placeMetalNodes defaults favor copper over silver over gold with no diamonds', () => {
  const gridWidth = 128
  const gridHeight = 128
  const metalsRaster = makeScatteredRaster(300, gridWidth, gridHeight)
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 777,
    maxNodes: 60,
  })

  const counts = countByKind(nodes)
  assert.ok(nodes.length >= 20)
  assert.strictEqual(counts.diamond, 0)
  assert.ok(counts.copper >= counts.silver)
  assert.ok(counts.silver >= counts.gold)
  assert.ok(counts.copper > counts.gold)
})

test('placeMetalNodes weights change the mix without changing the deposit count', () => {
  const gridWidth = 128
  const gridHeight = 128
  const metalsRaster = makeScatteredRaster(300, gridWidth, gridHeight)
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)
  const base = {
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 5150,
    maxNodes: 60,
  }

  const defaults = placeMetalNodes(base)
  const goldHeavy = placeMetalNodes({
    ...base,
    occurrenceWeights: { copper: 1, silver: 1, gold: 100, diamond: 5 },
  })

  assert.strictEqual(defaults.length, goldHeavy.length)
  for (let i = 0; i < defaults.length; i += 1) {
    assert.strictEqual(defaults[i].x, goldHeavy[i].x)
    assert.strictEqual(defaults[i].y, goldHeavy[i].y)
  }

  const goldHeavyCounts = countByKind(goldHeavy)
  assert.ok(goldHeavyCounts.gold > countByKind(defaults).gold)
  assert.ok(goldHeavyCounts.diamond > 0)
})

test('placeMetalNodes with diamond weight zero never places diamonds', () => {
  const gridWidth = 128
  const gridHeight = 128
  const metalsRaster = makeScatteredRaster(300, gridWidth, gridHeight)
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)

  const nodes = placeMetalNodes({
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 314,
    maxNodes: 60,
    occurrenceWeights: { copper: 50, silver: 25, gold: 25, diamond: 0 },
  })

  assert.strictEqual(countByKind(nodes).diamond, 0)
})
