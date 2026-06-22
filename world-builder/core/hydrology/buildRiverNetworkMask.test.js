import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

function makeRamp(width, height) {
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.5)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 2; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.5 * x) / width
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    elevation[y * width + (width - 2)] = SEA_LEVEL - 0.05
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
    rainfall: new Float32Array(width * height).fill(1),
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
  assert.ok(marked > 0, 'expected at least one major river corridor on the ramp')

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
    rainfall: new Float32Array(width * height).fill(1),
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

test('buildRiverNetworkMask skips outlets that drain to the closed-island rim', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.55)
  for (let y = 1; y < height - 1; y += 1) {
    elevation[y * width + 1] = 0.7 - (y - 1) * 0.04
  }
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.6),
  })

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })

  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    assert.ok(
      !(downstream >= 0 && ocean[downstream] && (downstream % width === 0 || downstream % width === width - 1)),
      'river mask should not include cells draining to the map rim',
    )
  }
})

/**
 * @param {number} width
 * @param {number} height
 */
function makeParallelValleyTerrain(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (x >= width - 4) {
        elevation[idx] = SEA_LEVEL - 0.1
        continue
      }
      const ridge = 0.003 * Math.cos((2 * Math.PI * y) / 12)
      elevation[idx] = SEA_LEVEL + 0.05 + ((width - x) / width) * 0.5 + ridge
    }
  }
  return elevation
}

test('buildRiverNetworkMask consolidates parallel coastal outlets', () => {
  const width = 128
  const height = 128
  const elevation = makeParallelValleyTerrain(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })

  let mouthCount = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || ocean[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0 && ocean[downstream]) {
      mouthCount += 1
    }
  }

  assert.ok(
    mouthCount < height / 16,
    `expected consolidated mouths, got ${mouthCount}`,
  )
})

test('buildRiverNetworkMask traces merged tributaries from a junction', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.1)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 3; x += 1) {
      const distToCoast = width - 4 - x
      const distToCenterY = Math.abs(y - 16)
      elevation[y * width + x] =
        SEA_LEVEL + 0.12 + distToCoast * 0.004 + distToCenterY * 0.012
    }
  }

  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(4),
  })
  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    navigableFlowCutoffScale: 0.5,
  })

  let markedUpper = 0
  let markedLower = 0
  for (let y = 1; y < 16; y += 1) {
    for (let x = 8; x < 26; x += 1) {
      if (mask[y * width + x]) markedUpper += 1
    }
  }
  for (let y = 17; y < height - 1; y += 1) {
    for (let x = 8; x < 26; x += 1) {
      if (mask[y * width + x]) markedLower += 1
    }
  }

  assert.ok(markedUpper > 0, 'expected upper tributary corridor')
  assert.ok(markedLower > 0, 'expected lower tributary corridor')
})

test('buildRiverNetworkMask merges lake inflow outlets per lake', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(0.7)
  const lakeMask = new Uint8Array(width * height)

  for (let y = 10; y <= 14; y += 1) {
    for (let x = 14; x <= 18; x += 1) {
      elevation[y * width + x] = 0.45
      lakeMask[y * width + x] = 1
    }
  }

  for (let y = 10; y <= 14; y += 1) {
    for (let x = 8; x <= 13; x += 1) {
      elevation[y * width + x] = 0.55 + (13 - x) * 0.01
    }
  }

  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(2),
  })

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    lakeMask,
    navigableFlowCutoffScale: 0.25,
  })

  let lakeShoreMouths = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || ocean[idx] || lakeMask[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0 && lakeMask[downstream]) {
      lakeShoreMouths += 1
    }
  }

  assert.ok(
    lakeShoreMouths < 8,
    `expected merged lake inflow outlets, got ${lakeShoreMouths}`,
  )
})
