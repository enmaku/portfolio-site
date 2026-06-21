import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

function makeRamp(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.5 * x) / width
    }
  }
  return elevation
}

test('buildRiverNetworkMask marks a connected path on a gentle ramp', () => {
  const width = 32
  const height = 32
  const elevation = makeRamp(width, height)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })

  let marked = 0
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) marked += 1
  }
  assert.ok(marked > width)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (!mask[idx]) continue
      const downstream = downstreamIndex(idx, width, flowDirection)
      assert.ok(downstream >= 0)
      assert.ok(mask[downstream] || ocean[downstream])
    }
  }
})

test('buildRiverNetworkMask excludes inland sinks that never reach the sea', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.65)
  elevation[8 * width + 8] = 0.42
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })

  assert.strictEqual(mask[8 * width + 8], 0)
})
