import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../worldBuilderPageModel.js'
import {
  buildFlowWeightedRiverCorridorMask,
  buildRiverCorridorRenderState,
  computeRiverNetworkMaxChannelWidth,
  resolveRiverCorridorNormalizedFlow,
  resolveRiverCorridorRenderRadius,
  riverCorridorRadiusForChannelWidth,
  riverCorridorRadiusForDrainage,
} from './riverCorridorDisplay.js'

test('riverCorridorRadiusForDrainage grows with drainage and caps at max radius', () => {
  assert.strictEqual(riverCorridorRadiusForDrainage(0), 0)
  assert.strictEqual(riverCorridorRadiusForDrainage(0.02), 1)
  assert.ok(riverCorridorRadiusForDrainage(0.2) >= 1)
  assert.strictEqual(riverCorridorRadiusForDrainage(1), 2)
})

test('buildFlowWeightedRiverCorridorMask widens high-flow reaches more than headwaters', () => {
  const width = 15
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const drainage = new Float32Array(width * height)
  const channelWidth = new Float32Array(width * height)

  riverNetworkMask[1 * width + 3] = 1
  drainage[1 * width + 3] = 0.05
  channelWidth[1 * width + 3] = 1
  riverNetworkMask[1 * width + 11] = 1
  drainage[1 * width + 11] = 0.9
  channelWidth[1 * width + 11] = 9

  const mask = buildFlowWeightedRiverCorridorMask(
    riverNetworkMask,
    drainage,
    width,
    height,
    { channelWidth, maxChannelWidth: 9 },
  )

  let headwaterWidth = 0
  let mouthWidth = 0
  for (let dx = -3; dx <= 3; dx += 1) {
    if (mask[1 * width + 3 + dx]) headwaterWidth += 1
    if (mask[1 * width + 11 + dx]) mouthWidth += 1
  }

  assert.ok(mouthWidth > headwaterWidth)
})

test('riverCorridorRadiusForChannelWidth grows monotonically and caps at max radius', () => {
  const maxChannelWidth = 10
  assert.strictEqual(riverCorridorRadiusForChannelWidth(0, maxChannelWidth), 0)
  const tributary = riverCorridorRadiusForChannelWidth(2, maxChannelWidth)
  const trunk = riverCorridorRadiusForChannelWidth(9, maxChannelWidth)
  assert.ok(tributary >= 1)
  assert.ok(trunk > tributary)
  assert.strictEqual(riverCorridorRadiusForChannelWidth(maxChannelWidth, maxChannelWidth), 2)
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
  const state = buildRiverCorridorRenderState({
    riverNetworkMask: new Uint8Array([0, 1, 0, 0]),
    fields: { drainage },
  })
  assert.ok(state)
  assert.strictEqual(state.maxChannelWidth, 0)
  assert.strictEqual(state.drainage, drainage)
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

test('default seed generation yields wider trunk than tributary render radii', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.channelWidth)

  const maxChannelWidth = computeRiverNetworkMaxChannelWidth(
    doc.channelWidth,
    doc.riverNetworkMask,
  )
  assert.ok(maxChannelWidth > 0)

  let minPositiveWidth = maxChannelWidth
  for (let idx = 0; idx < doc.channelWidth.length; idx += 1) {
    if (!doc.riverNetworkMask[idx]) continue
    const width = doc.channelWidth[idx]
    if (width > 0 && width < minPositiveWidth) {
      minPositiveWidth = width
    }
  }

  const trunkRadius = resolveRiverCorridorRenderRadius({
    drainage: doc.fields.drainage[0],
    channelWidth: maxChannelWidth,
    maxChannelWidth,
  })
  const tributaryRadius = resolveRiverCorridorRenderRadius({
    drainage: doc.fields.drainage[0],
    channelWidth: minPositiveWidth,
    maxChannelWidth,
  })

  assert.ok(trunkRadius > tributaryRadius)
})
