import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL, SNOW_CAP_ELEVATION_MIN } from '../biomeIds.js'
import { applyClosedIslandRim, isOceanCell } from '../fields/applyClosedIslandRim.js'
import { applyRainShadow } from '../fields/applyRainShadow.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import { computeFlowPartitions } from './dInfinityFlow.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [value]
 * @returns {Float32Array}
 */
function uniformRainfall(width, height, value = 0.5) {
  return new Float32Array(width * height).fill(value)
}

/**
 * Simple west-to-east ramp watershed draining to the right edge.
 * @param {number} width
 * @param {number} height
 * @returns {{ elevation: Float32Array, mouthIdx: number }}
 */
function rampWatershed(width, height) {
  const elevation = new Float32Array(width * height).fill(0.95)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = 0.9 - x * 0.02
    }
  }
  const mouthIdx = Math.floor(height / 2) * width + (width - 2)
  return { elevation, mouthIdx }
}

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
    rainfall: uniformRainfall(width, height),
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
    rainfall: uniformRainfall(width, height),
  })
  const downstream = downstreamIndex(idx, width, flowDirection)

  assert.strictEqual(downstream, 8 * width)
})

test('doubling rainfall at least doubles mouth flux on a fixed watershed', () => {
  const width = 12
  const height = 5
  const { elevation, mouthIdx } = rampWatershed(width, height)
  const baseRainfall = uniformRainfall(width, height, 0.4)
  const doubledRainfall = uniformRainfall(width, height, 0.8)

  const baseFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: baseRainfall,
  }).flowAccumulation[mouthIdx]
  const doubledFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: doubledRainfall,
  }).flowAccumulation[mouthIdx]

  assert.ok(doubledFlow >= baseFlow * 2 * 0.95)
})

test('high infiltration reduces mouth flux versus low infiltration', () => {
  const width = 16
  const height = 3
  const { elevation, mouthIdx } = rampWatershed(width, height)
  const rainfall = uniformRainfall(width, height, 0.6)
  const cellCount = width * height
  const lowDrainage = new Float32Array(cellCount).fill(0.1)
  const highDrainage = new Float32Array(cellCount).fill(0.95)

  const lowFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
    soilDrainage: lowDrainage,
    soilDrainageScale: 1,
  }).flowAccumulation[mouthIdx]
  const highFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
    soilDrainage: highDrainage,
    soilDrainageScale: 1,
  }).flowAccumulation[mouthIdx]

  assert.ok(highFlow < lowFlow)
})

test('rain shadow lower rainfall yields lower downstream accumulation', () => {
  const width = 24
  const height = 8
  const elevation = new Float32Array(width * height).fill(0.95)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 4; x < 10; x += 1) {
      elevation[y * width + x] = 0.98
    }
    for (let x = 10; x < width - 1; x += 1) {
      elevation[y * width + x] = 0.82 - (x - 10) * 0.03
    }
  }

  const baseRainfall = uniformRainfall(width, height, 0.85)
  const shadowedRainfall = applyRainShadow({
    rainfall: baseRainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
    rainShadowStrength: 1,
  })

  const windwardIdx = 4 * width + 9
  const leewardIdx = 4 * width + 18
  assert.ok(shadowedRainfall[leewardIdx] < shadowedRainfall[windwardIdx] * 0.85)

  const downstreamIdx = 4 * width + (width - 2)
  const uniformFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: baseRainfall,
  }).flowAccumulation[downstreamIdx]
  const shadowedFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: shadowedRainfall,
  }).flowAccumulation[downstreamIdx]

  assert.ok(shadowedFlow < uniformFlow)
})

test('D-infinity splits flow across a ridge facet on a filled DEM', () => {
  const width = 9
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = 0.7 - Math.hypot(x - 4, y - 4) * 0.06
    }
  }

  const ocean = Array.from({ length: width * height }, () => false)
  const partitions = computeFlowPartitions({ elevation, width, height, ocean })
  const splitCell = partitions.find(
    (partition) =>
      partition.primaryFraction > 0.05 &&
      partition.primaryFraction < 0.95 &&
      partition.secondaryFraction > 0.05,
  )

  assert.ok(splitCell, 'expected at least one D-infinity split cell in the watershed')
})

test('flow accumulation is deterministic for fixed grids', () => {
  const width = 10
  const height = 6
  const { elevation, mouthIdx } = rampWatershed(width, height)
  const rainfall = uniformRainfall(width, height, 0.55)

  const first = computeFlowAccumulation({ elevation, width, height, rainfall })
  const second = computeFlowAccumulation({ elevation, width, height, rainfall })

  assert.deepStrictEqual(first.flowDirection, second.flowDirection)
  assert.deepStrictEqual(first.flowAccumulation, second.flowAccumulation)
  assert.ok(first.flowAccumulation[mouthIdx] > 0)
})

test('downstream discharge is monotonic along a single D8 trunk', () => {
  const width = 8
  const height = 3
  const { elevation } = rampWatershed(width, height)
  const rainfall = uniformRainfall(width, height, 0.5)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })

  let idx = 1 * width + 1
  let previous = flowAccumulation[idx]
  for (let step = 0; step < width - 3; step += 1) {
    const downstream = downstreamIndex(idx, width, flowDirection)
    assert.ok(downstream >= 0)
    assert.ok(flowAccumulation[downstream] >= previous)
    previous = flowAccumulation[downstream]
    idx = downstream
  }
})

test('wet climate yields higher mouth flux than dry on the same watershed', () => {
  const width = 12
  const height = 5
  const { elevation, mouthIdx } = rampWatershed(width, height)
  const wetRainfall = uniformRainfall(width, height, 0.9)
  const dryRainfall = uniformRainfall(width, height, 0.1)

  const wetFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: wetRainfall,
  }).flowAccumulation[mouthIdx]
  const dryFlow = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: dryRainfall,
  }).flowAccumulation[mouthIdx]

  assert.ok(wetFlow > dryFlow * 2)
})

test('computeFlowAccumulation requires rainfall', () => {
  const elevation = new Float32Array(4).fill(0.5)
  assert.throws(
    () => computeFlowAccumulation({ elevation, width: 2, height: 2 }),
    /rainfall is required/,
  )
})

test('downstreamIndex returns -1 when flow direction points outside the grid', () => {
  const width = 4
  const height = 4
  const flowDirection = new Int16Array(width * height).fill(-1)
  flowDirection[0] = 0
  flowDirection[width - 1] = 2
  flowDirection[(height - 1) * width] = 6
  flowDirection[width * height - 1] = 4

  assert.strictEqual(downstreamIndex(0, width, flowDirection), -1)
  assert.strictEqual(downstreamIndex(width - 1, width, flowDirection), -1)
  assert.strictEqual(downstreamIndex((height - 1) * width, width, flowDirection), -1)
  assert.strictEqual(downstreamIndex(width * height - 1, width, flowDirection), -1)
})

test('computeFlowPartitions keep downstream indices inside the grid on rim terrain', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.4)
  applyClosedIslandRim(elevation, width, height)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.2 + (width - x) * 0.01
    }
  }

  const { flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall: uniformRainfall(width, height),
  })
  const ocean = isOceanCell(elevation, width, height, SEA_LEVEL)
  const partitions = computeFlowPartitions({
    elevation,
    width,
    height,
    ocean,
    seaLevel: SEA_LEVEL,
  })

  for (let idx = 0; idx < cellCount; idx += 1) {
    const partition = partitions[idx]
    for (const downstreamIdx of [partition.primaryIdx, partition.secondaryIdx]) {
      if (downstreamIdx < 0) continue
      assert.ok(downstreamIdx < cellCount, `partition downstream ${downstreamIdx} out of bounds`)
    }
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0) {
      assert.ok(downstream < cellCount)
    }
  }
})

test('computeFlowAccumulation never writes flow accumulation outside the grid', () => {
  const width = 3
  const height = 3
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.9)
  elevation[0] = 1
  elevation[1] = 0.8
  elevation[width] = 0.7

  const { flowAccumulation, flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: uniformRainfall(width, height),
  })

  assert.strictEqual(flowAccumulation.length, cellCount)
  for (let idx = 0; idx < cellCount; idx += 1) {
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0) {
      assert.ok(downstream < cellCount)
    }
  }
})
