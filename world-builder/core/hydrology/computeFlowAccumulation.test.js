import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL, SNOW_CAP_ELEVATION_MIN } from '../biomeIds.js'
import { applyClosedIslandRim } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'

test('highland near closed rim drains inland rather than into the map edge', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.5)
  applyClosedIslandRim(elevation, width, height)

  for (let y = 8; y < 24; y += 1) {
    for (let x = 4; x < width - 2; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.12 + (width - x) * 0.008
    }
  }
  const snowIdx = 16 * width + 4
  elevation[snowIdx] = SNOW_CAP_ELEVATION_MIN + 0.04

  const { flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
  })
  const downstream = downstreamIndex(snowIdx, width, flowDirection)

  assert.ok(downstream >= 0)
  assert.notStrictEqual(
    downstream % width,
    0,
    'snow-melt headwater should not drain directly into the left rim',
  )
})

test('coastal lowland adjacent to closed rim can drain into map-edge ocean', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.05)
  applyClosedIslandRim(elevation, width, height)

  const idx = 8 * width + 1
  const { flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
  })
  const downstream = downstreamIndex(idx, width, flowDirection)

  assert.strictEqual(downstream, 8 * width)
})
