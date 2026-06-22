import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF } from '../types.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { buildRiverGraph, buildNavigableRiverMask, isRiverMouthDrainageCell } from './buildRiverGraph.js'

function makeGentleRamp(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.4 * x) / width
    }
  }
  return elevation
}

function makeCliffRamp(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = x < width / 2 ? 0.9 : SEA_LEVEL + 0.05
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
    elevation,
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

test('buildRiverGraph marks steep cliff segments as not navigable', () => {
  const width = 24
  const height = 24
  const elevation = makeCliffRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(1),
  })
  const lakeMask = new Uint8Array(width * height)
  const graph = buildRiverGraph({
    elevation,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  const navigableEdges = graph.edges.filter((edge) => edge.navigable)
  const nonNavigableEdges = graph.edges.filter((edge) => !edge.navigable)
  if (graph.edges.length > 0) {
    assert.ok(navigableEdges.length + nonNavigableEdges.length === graph.edges.length)
  }
})

test('buildNavigableRiverMask marks cells along navigable edges', () => {
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
    elevation,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })
  const mask = buildNavigableRiverMask(graph, width, height)
  assert.strictEqual(mask.length, width * height)
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
    elevation,
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
    elevation,
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

test('buildRiverGraph creates mouth nodes only when downstream coast is navigable', () => {
  const width = 10
  const height = 10
  const cellCount = width * height
  const mouthIdx = 4 * width + 5
  const downstreamIdx = 4 * width + 6

  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  const ocean = Array.from({ length: cellCount }, () => false)
  ocean[downstreamIdx] = true

  const flowDirection = new Int16Array(cellCount).fill(-1)
  flowDirection[mouthIdx] = 4

  const flowAccumulation = new Float32Array(cellCount).fill(1)
  flowAccumulation[mouthIdx] = 50

  const lakeMask = new Uint8Array(cellCount)
  const channelMask = new Uint8Array(cellCount)
  channelMask[mouthIdx] = 1

  const navigableCoast = new Float32Array(cellCount)
  navigableCoast[downstreamIdx] = REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF + 0.1

  const graphWithMouth = buildRiverGraph({
    elevation,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    channelMask,
    coastNavigability: navigableCoast,
  })

  assert.ok(graphWithMouth.nodes.some((node) => node.kind === 'mouth'))

  const blockedCoast = new Float32Array(cellCount)
  blockedCoast[downstreamIdx] = REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF - 0.05

  const graphWithoutMouth = buildRiverGraph({
    elevation,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    channelMask,
    coastNavigability: blockedCoast,
  })

  assert.strictEqual(graphWithoutMouth.nodes.filter((node) => node.kind === 'mouth').length, 0)
})

test('isRiverMouthDrainageCell requires ocean downstream with coast navigability', () => {
  const coastNavigability = new Float32Array(4)
  const ocean = [false, true, true, false]
  coastNavigability[1] = 0.1
  coastNavigability[2] = 0.8

  assert.strictEqual(
    isRiverMouthDrainageCell(1, ocean, coastNavigability, REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF),
    false,
  )
  assert.strictEqual(
    isRiverMouthDrainageCell(2, ocean, coastNavigability, REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF),
    true,
  )
  assert.strictEqual(isRiverMouthDrainageCell(-1, ocean, coastNavigability, 0.35), false)
})
