import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  buildRiverGraph,
  countMaskedUpstreamChannelCells,
  isRiverMouthDrainageCell,
  qualifiesAsRiverMouth,
} from './buildRiverGraph.js'
import { buildNavigableRiverMask } from './riverNetwork.js'
import { minRiverMouthChannelCellsForGrid } from '../types.js'

function makeGentleRamp(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.4 * x) / width
    }
  }
  return elevation
}

test('buildRiverGraph creates mouth nodes at coast on gentle ramp', () => {
  const width = 32
  const height = 32
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  const mouths = graph.nodes.filter((node) => node.kind === 'mouth')
  assert.ok(graph.nodes.length > 0)
  assert.ok(mouths.length > 0)
})

test('buildRiverGraph marks every edge as navigable', () => {
  const width = 24
  const height = 24
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  if (graph.edges.length > 0) {
    assert.ok(graph.edges.every((edge) => edge.navigable))
  }
})

test('buildNavigableRiverMask marks cells along graph edges', () => {
  const width = 32
  const height = 32
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })
  const mask = buildNavigableRiverMask(graph, width, height)
  assert.strictEqual(mask.length, width * height)
  assert.ok(mask.some((value) => value === 1))
})

test('buildRiverGraph with channelMask only emits nodes on masked cells', () => {
  const width = 40
  const height = 40
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const channelMask = new Uint8Array(width * height)
  for (let x = 8; x <= 24; x += 1) {
    channelMask[Math.floor(height / 2) * width + x] = 1
  }
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    navigableFlowCutoffScale: 0.25,
    channelMask,
  })

  for (const node of graph.nodes) {
    assert.ok(channelMask[node.y * width + node.x])
  }
})

test('buildRiverGraph stays sparse on a 64x64 generated elevation field', () => {
  const width = 64
  const height = 64
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  assert.ok(graph.nodes.length < 5000)
  assert.ok(graph.edges.length < 5000)
})

test('buildRiverGraph creates mouth nodes when downstream cell is ocean', () => {
  const width = 10
  const height = 10
  const cellCount = width * height
  const mouthIdx = 4 * width + 5
  const downstreamIdx = 4 * width + 6
  const minChannelCells = minRiverMouthChannelCellsForGrid(width)

  const ocean = Array.from({ length: cellCount }, () => false)
  ocean[downstreamIdx] = true

  const flowDirection = new Int16Array(cellCount).fill(-1)
  for (let offset = 0; offset < minChannelCells; offset += 1) {
    const idx = 4 * width + (5 - offset)
    const nextIdx = idx + 1
    if (nextIdx === downstreamIdx) continue
    flowDirection[idx] = 4
  }
  flowDirection[mouthIdx] = 4

  const flowAccumulation = new Float32Array(cellCount).fill(1)
  flowAccumulation[mouthIdx] = 50

  const lakeMask = new Uint8Array(cellCount)
  const channelMask = new Uint8Array(cellCount)
  for (let offset = 0; offset < minChannelCells; offset += 1) {
    channelMask[4 * width + (5 - offset)] = 1
  }

  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    channelMask,
  })

  assert.ok(graph.nodes.some((node) => node.kind === 'mouth'))
})

test('buildRiverGraph rejects mouth nodes on channel dribbles shorter than minimum length', () => {
  const width = 10
  const height = 10
  const cellCount = width * height
  const mouthIdx = 4 * width + 5
  const downstreamIdx = 4 * width + 6

  const ocean = Array.from({ length: cellCount }, () => false)
  ocean[downstreamIdx] = true

  const flowDirection = new Int16Array(cellCount).fill(-1)
  flowDirection[mouthIdx] = 4

  const flowAccumulation = new Float32Array(cellCount).fill(1)
  flowAccumulation[mouthIdx] = 50

  const lakeMask = new Uint8Array(cellCount)
  const channelMask = new Uint8Array(cellCount)
  channelMask[mouthIdx] = 1

  const graph = buildRiverGraph({
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    channelMask,
  })

  assert.strictEqual(graph.nodes.filter((node) => node.kind === 'mouth').length, 0)
})

test('qualifiesAsRiverMouth counts upstream cells in the channel mask', () => {
  const channelMask = new Uint8Array(9)
  channelMask[0] = 1
  channelMask[1] = 1
  channelMask[2] = 1
  const upstream = [[], [0], [1]]
  assert.strictEqual(countMaskedUpstreamChannelCells(2, channelMask, upstream), 3)
  assert.strictEqual(qualifiesAsRiverMouth(2, channelMask, upstream, 3), true)
  assert.strictEqual(qualifiesAsRiverMouth(2, channelMask, upstream, 4), false)
})

test('isRiverMouthDrainageCell requires ocean downstream', () => {
  const ocean = [false, true, false, false]

  assert.strictEqual(isRiverMouthDrainageCell(1, ocean), true)
  assert.strictEqual(isRiverMouthDrainageCell(0, ocean), false)
  assert.strictEqual(isRiverMouthDrainageCell(-1, ocean), false)
})
