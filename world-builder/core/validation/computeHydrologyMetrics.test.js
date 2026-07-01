import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { readRiverNetworkFromWorldDocument } from '../hydrology/riverNetwork.js'
import { assembleRiverNetwork } from '../hydrology/riverNetwork.js'
import { computeHydrologyMetrics } from './computeHydrologyMetrics.js'

function makeElevation(width, height, fill = 0.5) {
  return new Float32Array(width * height).fill(fill)
}

function makeRiverNetwork(width, height, centerlineIndices, graph) {
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  for (const idx of centerlineIndices) {
    centerline[idx] = 1
  }
  return assembleRiverNetwork({
    centerline,
    corridor: centerline,
    flowDirection: new Int16Array(cellCount).fill(-1),
    flowAccumulation: new Float32Array(cellCount).fill(0.1),
    graph,
    width,
    height,
  })
}

test('computeHydrologyMetrics uses riverNetwork.centerline only', () => {
  const width = 8
  const height = 8
  const cellCount = width * height

  const graph = {
    nodes: [
      { id: 's', x: 2, y: 1, kind: 'source' },
      { id: 'm', x: 2, y: 4, kind: 'mouth' },
    ],
    edges: [
      {
        fromNodeId: 's',
        toNodeId: 'm',
        navigable: true,
        cellPath: [10, 18],
      },
    ],
  }
  const riverNetwork = makeRiverNetwork(width, height, [10, 18], graph)

  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(cellCount).fill(0.1),
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.strictEqual(metrics.riverCellCount, 2)
  assert.strictEqual(metrics.mouthCount, 1)
})

test('computeHydrologyMetrics requires riverNetwork.centerline', () => {
  assert.throws(
    () =>
      computeHydrologyMetrics({
        elevation: makeElevation(4, 4),
        drainage: new Float32Array(16).fill(0.1),
        riverGraph: { nodes: [], edges: [] },
        gridWidth: 4,
        gridHeight: 4,
      }),
    /riverNetwork\.centerline required/,
  )
})

test('computeHydrologyMetrics counts river cells from network centerline', () => {
  const width = 8
  const height = 8
  const elevation = makeElevation(width, height)
  elevation[10] = 0.9
  elevation[18] = 0.7
  elevation[26] = 0.6
  elevation[34] = 0.55

  const graph = {
    nodes: [
      { id: 's', x: 2, y: 1, kind: 'source' },
      { id: 'm', x: 2, y: 4, kind: 'mouth' },
    ],
    edges: [
      {
        fromNodeId: 's',
        toNodeId: 'm',
        navigable: true,
        cellPath: [10, 18, 26, 34],
      },
    ],
  }
  const riverNetwork = makeRiverNetwork(width, height, [10, 18, 26, 34], graph)

  const metrics = computeHydrologyMetrics({
    elevation,
    drainage: new Float32Array(width * height).fill(0.1),
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.strictEqual(metrics.riverCellCount, 4)
  assert.strictEqual(metrics.navigableEdgeCount, 1)
  assert.ok(metrics.navigableKmEstimate > 0)
  assert.strictEqual(metrics.mouthCount, 1)
})

test('computeHydrologyMetrics estimates Hack law exponent on synthetic trunk', () => {
  const width = 32
  const height = 32
  const cellCount = width * height
  const elevation = makeElevation(width, height)
  const drainage = new Float32Array(cellCount)

  const trunkCells = []
  for (let step = 0; step < 16; step += 1) {
    const y = 4 + step
    const idx = y * width + 8
    trunkCells.push(idx)
    elevation[idx] = 1 - step * 0.03
    drainage[idx] = Math.pow(step + 1, 2)
  }

  const nodes = [
    { id: 's', x: 8, y: 4, kind: 'source' },
    { id: 'm', x: 8, y: 19, kind: 'mouth' },
  ]
  const edges = [
    { fromNodeId: 's', toNodeId: 'm', navigable: true, cellPath: trunkCells },
  ]
  const riverNetwork = makeRiverNetwork(width, height, trunkCells, { nodes, edges })

  const metrics = computeHydrologyMetrics({
    elevation,
    drainage,
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.ok(metrics.hacksLawExponent !== null)
  assert.ok(metrics.hacksLawExponent > 0.35)
  assert.ok(metrics.hacksLawExponent < 0.85)
  assert.ok(metrics.slopeAreaConcavitySamples.length >= 2)
})

test('computeHydrologyMetrics detects parallel strand overlap', () => {
  const width = 10
  const height = 10
  const sharedPath = [15, 25, 35]
  const parallelPath = [16, 26, 36]
  const graph = {
    nodes: [
      { id: 'a', x: 5, y: 1, kind: 'source' },
      { id: 'b', x: 5, y: 3, kind: 'mouth' },
    ],
    edges: [
      { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: sharedPath },
      { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: parallelPath },
    ],
  }
  const riverNetwork = makeRiverNetwork(
    width,
    height,
    [...sharedPath, ...parallelPath],
    graph,
  )
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(width * height).fill(0.5),
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.ok(metrics.parallelStrandRatio > 0)
})

test('computeHydrologyMetrics measures coast-connected navigable path length', () => {
  const width = 12
  const height = 12
  const path = [14, 26, 38, 50, 62]
  const graph = {
    nodes: [
      { id: 's', x: 2, y: 1, kind: 'source' },
      { id: 'm', x: 2, y: 5, kind: 'mouth' },
    ],
    edges: [{ fromNodeId: 's', toNodeId: 'm', navigable: true, cellPath: path }],
  }
  const riverNetwork = makeRiverNetwork(width, height, path, graph)
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(width * height).fill(0.4),
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.strictEqual(metrics.coastConnectedNavigablePathLength, path.length)
})

test('computeHydrologyMetrics counts only navigable graph edges', () => {
  const width = 8
  const height = 8
  const graph = {
    nodes: [
      { id: 'a', x: 1, y: 1, kind: 'source' },
      { id: 'b', x: 2, y: 2, kind: 'mouth' },
    ],
    edges: [
      { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [9, 17] },
      { fromNodeId: 'a', toNodeId: 'b', navigable: false, cellPath: [10, 18] },
      { fromNodeId: 'a', toNodeId: 'b', navigable: false, cellPath: [11, 19] },
    ],
  }
  const riverNetwork = makeRiverNetwork(width, height, [9, 10, 11, 17, 18, 19], graph)
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(width * height).fill(0.1),
    riverNetwork,
    gridWidth: width,
    gridHeight: height,
  })

  assert.strictEqual(metrics.navigableEdgeCount, 1)
})

test('computeHydrologyMetrics returns null Hack exponent without navigable trunk samples', () => {
  const riverNetwork = makeRiverNetwork(4, 4, [], { nodes: [], edges: [] })
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(4, 4),
    drainage: new Float32Array(16).fill(0.1),
    riverNetwork,
    gridWidth: 4,
    gridHeight: 4,
  })

  assert.strictEqual(metrics.hacksLawExponent, null)
  assert.strictEqual(metrics.coastConnectedNavigablePathLength, 0)
})

function concavityChecksum(samples) {
  let checksum = 0
  for (let i = 0; i < samples.length; i += 1) {
    checksum = (checksum + Math.round(samples[i] * 1e4) * (i + 1)) % 2147483647
  }
  return checksum
}

test('computeHydrologyMetrics slope-area concavity preserves golden checksum on default simulation path', () => {
  const doc = generateDerivedGeography({
    geographySeed: 0,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })
  const riverNetwork = readRiverNetworkFromWorldDocument(doc)
  assert.ok(riverNetwork)
  const metrics = computeHydrologyMetrics({
    elevation: doc.fields.elevation,
    drainage: doc.fields.drainage,
    riverNetwork,
    gridWidth: 64,
    gridHeight: 64,
  })

  assert.ok(metrics.slopeAreaConcavitySamples.length > 0)
  assert.strictEqual(concavityChecksum(metrics.slopeAreaConcavitySamples), -2129564)
})
