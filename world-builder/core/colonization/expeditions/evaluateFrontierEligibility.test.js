import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { evaluateFrontierEligibility } from './evaluateFrontierEligibility.js'

function makeLandFrontierDoc() {
  const gridWidth = 8
  const gridHeight = 6
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  return {
    geographySeed: 10,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }
}

function baseParams(doc, settlement, overrides = {}) {
  return {
    settlement,
    doc,
    dryLandMask: buildDryLandTraversableMask(doc),
    landFrontierEdges: 4,
    maritimeFrontierEdges: 0,
    ...overrides,
  }
}

test('evaluateFrontierEligibility allows land dispatch when realm has land frontier', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'rim', x: 3, y: 2, population: 120 },
      { maritimeRole: 'none' },
    ),
  )

  assert.ok(eligible)
  assert.strictEqual(eligible.canDispatchLand, true)
  assert.strictEqual(eligible.canDispatchMaritime, false)
})

test('evaluateFrontierEligibility excludes land dispatch when realm land frontier is exhausted', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'rim', x: 3, y: 2, population: 120 },
      { landFrontierEdges: 0, maritimeRole: 'none' },
    ),
  )

  assert.strictEqual(eligible, null)
})

test('evaluateFrontierEligibility allows maritime dispatch when sail frontier remains', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'port', x: 3, y: 2, population: 100 },
      { maritimeFrontierEdges: 8, maritimeRole: 'port' },
    ),
  )

  assert.ok(eligible)
  assert.strictEqual(eligible.canDispatchMaritime, true)
})

test('evaluateFrontierEligibility excludes maritime dispatch when sail frontier is exhausted', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'port', x: 3, y: 2, population: 100 },
      { maritimeRole: 'port' },
    ),
  )

  assert.ok(eligible)
  assert.strictEqual(eligible.canDispatchMaritime, false)
  assert.strictEqual(eligible.canDispatchLand, true)
})

test('evaluateFrontierEligibility allows maritime dispatch when unvisited sail remains but edge count is zero', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'port', x: 3, y: 2, population: 100 },
      { maritimeRole: 'port', maritimeFrontierOpen: true },
    ),
  )

  assert.ok(eligible)
  assert.strictEqual(eligible.canDispatchMaritime, true)
})

test('evaluateFrontierEligibility allows port settlements to dispatch land and maritime', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(
      doc,
      { id: 'port', x: 3, y: 2, population: 100 },
      { maritimeRole: 'port', maritimeFrontierEdges: 8 },
    ),
  )

  assert.ok(eligible)
  assert.strictEqual(eligible.canDispatchLand, true)
  assert.strictEqual(eligible.canDispatchMaritime, true)
})

test('evaluateFrontierEligibility excludes zero population settlements', () => {
  const doc = makeLandFrontierDoc()
  const eligible = evaluateFrontierEligibility(
    baseParams(doc, { id: 'empty', x: 3, y: 2, population: 0 }),
  )

  assert.strictEqual(eligible, null)
})
