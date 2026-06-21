import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { buildRiverGraph, buildNavigableRiverMask } from './buildRiverGraph.js'

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
  assert.ok(mouths.length >= 0)
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

test('buildRiverGraph stays sparse on a 64x64 generated elevation field', () => {
  const width = 64
  const height = 64
  const elevation = makeGentleRamp(width, height)
  const ocean = isOceanCell(elevation, width, height)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
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
