import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPrimaryClaimAdjacencyUndirected,
  buildPrimaryClaimContact,
  countSharedPrimaryClaimBorderCells,
} from './primaryClaimAdjacency.js'

test('4-connected hinterlands share an undirected adjacency edge', () => {
  const primaryClaim = {
    a: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    b: [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
  }
  const adj = buildPrimaryClaimAdjacencyUndirected({
    primaryClaim,
    settlementIds: ['a', 'b'],
    gridWidth: 4,
    gridHeight: 4,
  })
  assert.equal(adj.has('a|b') || adj.has('b|a'), true)
  const pairs = [...adj]
  assert.equal(pairs.length, 1)
  assert.ok(pairs[0] === 'a|b' || pairs[0] === 'b|a')
})

test('diagonal-only contact does not create adjacency', () => {
  const primaryClaim = {
    a: [{ x: 0, y: 0 }],
    b: [{ x: 1, y: 1 }],
  }
  const adj = buildPrimaryClaimAdjacencyUndirected({
    primaryClaim,
    settlementIds: ['a', 'b'],
    gridWidth: 3,
    gridHeight: 3,
  })
  assert.equal(adj.size, 0)
})

test('multi-cell shared frontier stacks border cell count', () => {
  const primaryClaim = {
    a: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    b: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  }
  const count = countSharedPrimaryClaimBorderCells({
    primaryClaim,
    settlementIdA: 'a',
    settlementIdB: 'b',
    gridWidth: 4,
    gridHeight: 4,
  })
  assert.equal(count, 3)
})

test('buildPrimaryClaimContact matches pairwise border counts and adjacency', () => {
  const primaryClaim = {
    a: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    b: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    c: [{ x: 5, y: 5 }],
  }
  const { adjacencyPairs, borderCountByDirectedPair } = buildPrimaryClaimContact({
    primaryClaim,
    settlementIds: ['a', 'b', 'c'],
    gridWidth: 8,
    gridHeight: 8,
  })
  assert.equal(adjacencyPairs.has('a|b'), true)
  assert.equal(adjacencyPairs.has('a|c'), false)
  assert.equal(borderCountByDirectedPair.get('a|b'), 3)
  assert.equal(borderCountByDirectedPair.get('b|a'), 3)
  assert.equal(
    borderCountByDirectedPair.get('a|b'),
    countSharedPrimaryClaimBorderCells({
      primaryClaim,
      settlementIdA: 'a',
      settlementIdB: 'b',
      gridWidth: 8,
      gridHeight: 8,
    }),
  )
})
