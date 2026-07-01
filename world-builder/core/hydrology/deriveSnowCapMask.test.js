import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL, SNOW_CAP_ELEVATION_MIN, SNOW_CAP_TEMPERATURE_MAX } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import {
  deriveSnowCapMask,
  deriveSnowMeltContribution,
} from './deriveSnowCapMask.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

test('deriveSnowCapMask matches glacier elevation and temperature thresholds', () => {
  const width = 4
  const height = 4
  const elevation = new Float32Array(width * height).fill(0.5)
  const temperature = new Float32Array(width * height).fill(0.5)
  elevation[5] = SNOW_CAP_ELEVATION_MIN + 0.05
  temperature[5] = SNOW_CAP_TEMPERATURE_MAX - 0.05

  const mask = deriveSnowCapMask({ elevation, temperature, width, height, seaLevel: SEA_LEVEL })
  assert.strictEqual(mask[5], 1)
  assert.strictEqual(mask[0], 0)
})

test('deriveSnowMeltContribution adds flow only on snow-cap edge cells', () => {
  const width = 2
  const height = 1
  const elevation = new Float32Array([0.5, SNOW_CAP_ELEVATION_MIN + 0.1])
  const temperature = new Float32Array([0.5, SNOW_CAP_TEMPERATURE_MAX - 0.05])
  const snowCapMask = new Uint8Array([0, 1])
  const melt = deriveSnowMeltContribution({
    elevation,
    temperature,
    snowCapMask,
    width,
    height,
  })

  assert.strictEqual(melt[0], 0)
  assert.ok(melt[1] > 0)
})

test('deriveSnowMeltContribution skips interior snow-cap cells', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(SNOW_CAP_ELEVATION_MIN + 0.08)
  const temperature = new Float32Array(width * height).fill(SNOW_CAP_TEMPERATURE_MAX - 0.05)
  const snowCapMask = new Uint8Array(width * height)
  for (let y = 1; y < 4; y += 1) {
    for (let x = 1; x < 4; x += 1) {
      snowCapMask[y * width + x] = 1
    }
  }

  const melt = deriveSnowMeltContribution({
    elevation,
    temperature,
    snowCapMask,
    width,
    height,
  })

  assert.strictEqual(melt[2 * width + 2], 0)
  const meltOutletCount = melt.filter((value, idx) => value > 0 && snowCapMask[idx]).length
  assert.ok(meltOutletCount > 0)
  assert.ok(meltOutletCount < 8)
})

test('deriveSnowMeltContribution favors leeward cap edges for outlet placement', () => {
  const width = 9
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.4)
  const temperature = new Float32Array(width * height).fill(0.5)
  const snowCapMask = new Uint8Array(width * height)
  for (let y = 2; y < 7; y += 1) {
    for (let x = 2; x < 7; x += 1) {
      const idx = y * width + x
      elevation[idx] = SNOW_CAP_ELEVATION_MIN + 0.08
      temperature[idx] = SNOW_CAP_TEMPERATURE_MAX - 0.05
      snowCapMask[idx] = 1
    }
  }

  const eastWindMelt = deriveSnowMeltContribution({
    elevation,
    temperature,
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 90,
  })
  const westWindMelt = deriveSnowMeltContribution({
    elevation,
    temperature,
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 270,
  })

  let eastWindLeft = 0
  let westWindLeft = 0
  for (let y = 2; y < 7; y += 1) {
    for (let x = 2; x < 7; x += 1) {
      const idx = y * width + x
      if (!snowCapMask[idx] || eastWindMelt[idx] <= 0) continue
      if (x <= 3) eastWindLeft += 1
    }
  }
  for (let y = 2; y < 7; y += 1) {
    for (let x = 2; x < 7; x += 1) {
      const idx = y * width + x
      if (!snowCapMask[idx] || westWindMelt[idx] <= 0) continue
      if (x <= 3) westWindLeft += 1
    }
  }

  assert.ok(eastWindLeft > 0, 'expected east wind to place outlets on leeward west edge')
  assert.ok(westWindLeft < eastWindLeft, 'expected west wind to shift outlets away from west edge')
})

test('snow melt on a peak produces a river corridor downhill to the sea', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height)
  const temperature = new Float32Array(width * height).fill(0.5)

  for (let y = 8; y < 24; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.5 * x) / width
    }
  }

  for (let y = 10; y < 22; y += 1) {
    for (let x = 22; x < 28; x += 1) {
      const idx = y * width + x
      elevation[idx] = Math.max(elevation[idx], SNOW_CAP_ELEVATION_MIN + 0.06)
      temperature[idx] = SNOW_CAP_TEMPERATURE_MAX - 0.05
    }
  }

  const snowCapMask = deriveSnowCapMask({ elevation, temperature, width, height, seaLevel: SEA_LEVEL })
  assert.ok(snowCapMask.some((value) => value === 1), 'expected a snow cap on the high slope')

  const meltContribution = deriveSnowMeltContribution({
    elevation,
    temperature,
    snowCapMask,
    width,
    height,
  })
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
    meltContribution,
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    meltContribution,
  })

  let markedOnSlope = 0
  for (let y = 10; y < 22; y += 1) {
    for (let x = 8; x < 28; x += 1) {
      if (mask[y * width + x]) markedOnSlope += 1
    }
  }
  assert.ok(markedOnSlope > 0, 'expected snow-melt drainage down the slope')

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

test('buildRiverNetworkMask includes streams that terminate in inland lakes', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.65)
  elevation[8 * width + 8] = 0.42
  const lakeMask = new Uint8Array(width * height)
  lakeMask[8 * width + 8] = 1

  for (let x = 2; x < 8; x += 1) {
    elevation[8 * width + x] = 0.55 - x * 0.01
  }

  const meltContribution = new Float32Array(width * height)
  meltContribution[2 * width + 2] = 40

  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
    meltContribution,
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  let markedInflow = false
  for (let x = 2; x < 8; x += 1) {
    if (mask[8 * width + x]) markedInflow = true
  }
  assert.ok(markedInflow, 'expected traced corridor into inland lake')
})
