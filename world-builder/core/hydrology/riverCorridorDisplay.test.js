import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../worldBuilderPageModel.js'
import {
  buildFlowWeightedRiverCorridorMask,
  buildPhysicalRiverCorridorMask,
  buildRiverCorridorRenderState,
  capRiverCorridorRadiusAtWaterEdge,
  computeRiverNetworkMaxChannelWidth,
  flowPerpendicularStep,
  measurePhysicalRiverHalfWidth,
  physicalRiverMaxHalfWidthForGrid,
  resolveRiverCorridorNormalizedFlow,
  resolveRiverCorridorRenderRadius,
  riverCorridorRadiusForChannelWidth,
  riverCorridorRadiusForDrainage,
} from './riverCorridorDisplay.js'

test('riverCorridorRadiusForDrainage grows with drainage and caps at max radius', () => {
  assert.strictEqual(riverCorridorRadiusForDrainage(0), 0)
  assert.strictEqual(riverCorridorRadiusForDrainage(0.02), 1)
  assert.ok(riverCorridorRadiusForDrainage(0.2) >= 1)
  assert.strictEqual(riverCorridorRadiusForDrainage(1), 4)
})

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

test('buildPhysicalRiverCorridorMask fills trunk cross-section without axis-aligned gaps', () => {
  const width = 15
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.62)
  const flowDirection = new Int16Array(width * height).fill(-1)

  const headIdx = 1 * width + 3
  const trunkIdx = 1 * width + 11
  riverNetworkMask[headIdx] = 1
  riverNetworkMask[trunkIdx] = 1
  flowDirection[headIdx] = 4
  flowDirection[trunkIdx] = 6
  elevation[headIdx] = 0.58
  elevation[trunkIdx] = 0.54
  elevation[1 * width + 10] = 0.54
  elevation[1 * width + 12] = 0.54
  elevation[1 * width + 9] = 0.62
  elevation[1 * width + 13] = 0.62

  const mask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
  })

  let headwaterWidth = 0
  let trunkWidth = 0
  for (let dx = -3; dx <= 3; dx += 1) {
    if (mask[1 * width + 3 + dx]) headwaterWidth += 1
    if (mask[1 * width + 11 + dx]) trunkWidth += 1
  }

  assert.ok(trunkWidth > headwaterWidth)
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
  elevation[1 * width + 4] = 0.54
  elevation[1 * width + 3] = 0.58
  elevation[1 * width + 5] = 0.58

  const mask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
    ocean,
    lakeMask,
  })

  assert.strictEqual(mask[1 * width + 1], 1)
  assert.strictEqual(mask[1 * width + 0], 0)
  assert.strictEqual(mask[1 * width + 4], 1)
  assert.strictEqual(mask[1 * width + 3], 0)
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

test('flowPerpendicularStep returns integer perpendicular for diagonal flow', () => {
  const [stepX, stepY] = flowPerpendicularStep(2)
  assert.strictEqual(stepX, 1)
  assert.strictEqual(stepY, 1)
})

test('riverCorridorRadiusForChannelWidth grows monotonically and caps at max radius', () => {
  const maxChannelWidth = 10
  assert.strictEqual(riverCorridorRadiusForChannelWidth(0, maxChannelWidth), 0)
  const tributary = riverCorridorRadiusForChannelWidth(2, maxChannelWidth)
  const trunk = riverCorridorRadiusForChannelWidth(9, maxChannelWidth)
  assert.ok(tributary >= 1)
  assert.ok(trunk > tributary)
  assert.strictEqual(riverCorridorRadiusForChannelWidth(maxChannelWidth, maxChannelWidth), 4)
})

test('resolveRiverCorridorNormalizedFlow prefers channelWidth and falls back to drainage', () => {
  assert.strictEqual(
    resolveRiverCorridorNormalizedFlow({
      drainage: 0.05,
      channelWidth: 8,
      maxChannelWidth: 10,
    }),
    0.8,
  )
  assert.strictEqual(
    resolveRiverCorridorNormalizedFlow({
      drainage: 0.9,
      channelWidth: 0,
      maxChannelWidth: 10,
    }),
    0.9,
  )
})

test('buildRiverCorridorRenderState returns null without mask or flow fields', () => {
  assert.strictEqual(buildRiverCorridorRenderState({}), null)
  assert.strictEqual(
    buildRiverCorridorRenderState({ riverNetworkMask: new Uint8Array(4) }),
    null,
  )

  const drainage = new Float32Array(4)
  drainage[1] = 0.5
  const flowDirection = new Int16Array(4).fill(-1)
  const state = buildRiverCorridorRenderState({
    riverNetworkMask: new Uint8Array([0, 1, 0, 0]),
    fields: { drainage },
    flowDirection,
  })
  assert.ok(state)
  assert.strictEqual(state.maxChannelWidth, 0)
  assert.strictEqual(state.drainage, drainage)
  assert.strictEqual(state.flowDirection, flowDirection)
})

test('resolveRiverCorridorRenderRadius prefers channelWidth over drainage', () => {
  assert.strictEqual(
    resolveRiverCorridorRenderRadius({
      drainage: 0.05,
      channelWidth: 8,
      maxChannelWidth: 10,
    }),
    riverCorridorRadiusForChannelWidth(8, 10),
  )
  assert.strictEqual(
    resolveRiverCorridorRenderRadius({
      drainage: 0.9,
      channelWidth: 0,
      maxChannelWidth: 10,
    }),
    riverCorridorRadiusForDrainage(0.9),
  )
})

test('default seed generation yields narrower painted rivers than centerline mask alone', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.flowDirection)

  const centerlineCount = doc.riverNetworkMask.reduce((sum, value) => sum + value, 0)
  const painted = buildPhysicalRiverCorridorMask(
    doc.riverNetworkMask,
    doc.gridWidth,
    doc.gridHeight,
    {
      elevation: doc.fields.elevation,
      flowDirection: doc.flowDirection,
      lakeMask: doc.lakeMask,
    },
  )
  const paintedCount = painted.reduce((sum, value) => sum + value, 0)

  assert.ok(centerlineCount > 0)
  assert.ok(paintedCount >= centerlineCount)
  assert.ok(paintedCount <= centerlineCount * physicalRiverMaxHalfWidthForGrid(doc.gridWidth) * 4)
})

test('buildFlowWeightedRiverCorridorMask delegates to physical paint when flowDirection provided', () => {
  const width = 5
  const height = 5
  const riverNetworkMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.55)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const drainage = new Float32Array(width * height).fill(0.5)

  riverNetworkMask[12] = 1
  flowDirection[12] = 4

  const physical = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation,
    flowDirection,
  })
  const legacy = buildFlowWeightedRiverCorridorMask(
    riverNetworkMask,
    drainage,
    width,
    height,
    { elevation, flowDirection },
  )

  assert.deepStrictEqual(legacy, physical)
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
