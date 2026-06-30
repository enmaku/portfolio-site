import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../worldBuilderPageModel.js'
import {
  buildPhysicalRiverCorridorMask,
  capRiverCorridorRadiusAtWaterEdge,
  computeRiverNetworkMaxChannelWidth,
  flowPerpendicularStep,
  measurePhysicalRiverHalfWidth,
  smoothRiverCorridorMaskForDisplay,
} from './riverCorridorDisplay.js'

test('measurePhysicalRiverHalfWidth returns zero without measurable banks', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.55)
  const flowDirection = new Int16Array(width * height).fill(-1)
  flowDirection[12] = 4

  assert.strictEqual(
    measurePhysicalRiverHalfWidth({
      elevation,
      flowDirection,
      idx: 12,
      width,
      height,
    }),
    0,
  )
})

test('measurePhysicalRiverHalfWidth measures incised trench half-width', () => {
  const width = 9
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.62)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const centerIdx = 2 * width + 4
  flowDirection[centerIdx] = 4

  elevation[centerIdx] = 0.54
  elevation[1 * width + 4] = 0.54
  elevation[3 * width + 4] = 0.54
  elevation[0 * width + 4] = 0.62
  elevation[4 * width + 4] = 0.62

  const halfWidth = measurePhysicalRiverHalfWidth({
    elevation,
    flowDirection,
    idx: centerIdx,
    width,
    height,
  })

  assert.ok(halfWidth >= 1)
})

test('smoothRiverCorridorMaskForDisplay keeps dense blocks and prunes sparse cells', () => {
  const width = 7
  const height = 7
  const mask = new Uint8Array(width * height)
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      mask[y * width + x] = 1
    }
  }
  mask[1 * width + 4] = 1

  const smoothed = smoothRiverCorridorMaskForDisplay(mask, width, height, 1)

  assert.strictEqual(smoothed[3 * width + 3], 1)
  assert.strictEqual(smoothed[1 * width + 4], 0)
})

test('buildPhysicalRiverCorridorMask paints only centerline for headwaters on flat terrain', () => {
  const width = 7
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.55)
  const flowDirection = new Int16Array(width * height).fill(-1)

  riverNetworkMask[1 * width + 3] = 1
  flowDirection[1 * width + 3] = 4

  const mask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
  })

  assert.strictEqual(mask[1 * width + 3], 1)
  assert.strictEqual(mask[1 * width + 2], 0)
  assert.strictEqual(mask[1 * width + 4], 0)
})

test('buildPhysicalRiverCorridorMask fills incised trunk cross-section', () => {
  const width = 15
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.62)
  const flowDirection = new Int16Array(width * height).fill(-1)

  const trunkIdx = 1 * width + 11
  riverNetworkMask[trunkIdx] = 1
  flowDirection[trunkIdx] = 6

  elevation[trunkIdx] = 0.54
  elevation[1 * width + 10] = 0.54
  elevation[2 * width + 11] = 0.54
  elevation[0 * width + 11] = 0.62
  elevation[2 * width + 10] = 0.62

  const mask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
  })

  assert.strictEqual(mask[trunkIdx], 1)
  assert.ok(mask[1 * width + 10] === 1 || mask[2 * width + 11] === 1)
})

test('buildPhysicalRiverCorridorMask keeps centerline width at ocean and lake shores', () => {
  const width = 7
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.62)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const ocean = new Array(width * height).fill(false)
  const lakeMask = new Uint8Array(width * height)

  riverNetworkMask[1 * width + 1] = 1
  flowDirection[1 * width + 1] = 4
  ocean[1 * width + 2] = true
  riverNetworkMask[1 * width + 4] = 1
  flowDirection[1 * width + 4] = 4
  lakeMask[1 * width + 5] = 1

  const mask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
    ocean,
    lakeMask,
  })

  assert.strictEqual(mask[1 * width + 1], 1)
  assert.strictEqual(mask[1 * width + 4], 1)
})

test('capRiverCorridorRadiusAtWaterEdge zeroes radius beside water', () => {
  const width = 3
  const height = 3
  const ocean = [false, false, false, false, true, false, false, false, false]
  assert.strictEqual(
    capRiverCorridorRadiusAtWaterEdge(3, 0, 0, width, height, ocean, undefined),
    3,
  )
  assert.strictEqual(
    capRiverCorridorRadiusAtWaterEdge(3, 1, 0, width, height, ocean, undefined),
    0,
  )
})

test('capRiverCorridorRadiusAtWaterEdge zeroes radius when downstream is ocean', () => {
  const width = 5
  const height = 3
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)
  ocean[1 * width + 3] = true
  flowDirection[1 * width + 2] = 4

  assert.strictEqual(
    capRiverCorridorRadiusAtWaterEdge(
      3,
      2,
      1,
      width,
      height,
      ocean,
      undefined,
      flowDirection,
      1 * width + 2,
    ),
    0,
  )
})

test('flowPerpendicularStep returns integer perpendicular for diagonal flow', () => {
  const [stepX, stepY] = flowPerpendicularStep(2)
  assert.strictEqual(stepX, 1)
  assert.strictEqual(stepY, 1)
})

test('default seed generation paints wider rivers than centerline mask alone', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.flowDirection)

  const centerlineCount = doc.riverNetworkMask.reduce((sum, value) => sum + value, 0)
  const riverCellCount = doc.biomes.filter((biome) => biome === BIOMES.RIVER_CORRIDOR).length

  assert.ok(centerlineCount > 0)
  assert.ok(riverCellCount >= centerlineCount)
})

test('buildPhysicalRiverCorridorMask paints corridor from centerline and flow direction', () => {
  const width = 5
  const height = 5
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.55)
  const flowDirection = new Int16Array(width * height).fill(-1)

  riverNetworkMask[12] = 1
  flowDirection[12] = 4

  const corridor = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
  })

  assert.ok(corridor[12])
})

test('default seed generation exposes channel width for navigable graph metrics', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.channelWidth)
  const maxChannelWidth = computeRiverNetworkMaxChannelWidth(
    doc.channelWidth,
    doc.riverNetworkMask,
  )
  assert.ok(maxChannelWidth > 0)
})
