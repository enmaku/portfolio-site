import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHydrologyMetrics } from './computeHydrologyMetrics.js'

function makeElevation(width, height, fill = 0.5) {
  return new Float32Array(width * height).fill(fill)
}

test('computeHydrologyMetrics counts river cells from network mask', () => {
  const width = 8
  const height = 8
  const elevation = makeElevation(width, height)
  elevation[10] = 0.9
  elevation[18] = 0.7
  elevation[26] = 0.6
  elevation[34] = 0.55
  const riverNetworkMask = new Uint8Array(width * height)
  for (const idx of [10, 18, 26, 34]) {
    riverNetworkMask[idx] = 1
  }

  const metrics = computeHydrologyMetrics({
    elevation,
    drainage: new Float32Array(width * height).fill(0.1),
    riverGraph: {
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
    },
    riverNetworkMask,
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

  const metrics = computeHydrologyMetrics({
    elevation,
    drainage,
    riverGraph: { nodes, edges },
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
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(width * height).fill(0.5),
    riverGraph: {
      nodes: [
        { id: 'a', x: 5, y: 1, kind: 'source' },
        { id: 'b', x: 5, y: 3, kind: 'mouth' },
      ],
      edges: [
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: sharedPath },
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: parallelPath },
      ],
    },
    gridWidth: width,
    gridHeight: height,
  })

  assert.ok(metrics.parallelStrandRatio > 0)
})

test('computeHydrologyMetrics measures coast-connected navigable path length', () => {
  const width = 12
  const height = 12
  const path = [14, 26, 38, 50, 62]
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(width, height),
    drainage: new Float32Array(width * height).fill(0.4),
    riverGraph: {
      nodes: [
        { id: 's', x: 2, y: 1, kind: 'source' },
        { id: 'm', x: 2, y: 5, kind: 'mouth' },
      ],
      edges: [{ fromNodeId: 's', toNodeId: 'm', navigable: true, cellPath: path }],
    },
    gridWidth: width,
    gridHeight: height,
  })

  assert.strictEqual(metrics.coastConnectedNavigablePathLength, path.length)
})

test('computeHydrologyMetrics returns null Hack exponent without navigable trunk samples', () => {
  const metrics = computeHydrologyMetrics({
    elevation: makeElevation(4, 4),
    drainage: new Float32Array(16).fill(0.1),
    riverGraph: { nodes: [], edges: [] },
    gridWidth: 4,
    gridHeight: 4,
  })

  assert.strictEqual(metrics.hacksLawExponent, null)
  assert.strictEqual(metrics.coastConnectedNavigablePathLength, 0)
})
