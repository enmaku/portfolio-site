import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import {
  corridorPathDescends,
  findLeastResistancePath,
  routeFractalCorridorPath,
} from './riverPathfinding.js'
import {
  applySkipRefineTransition,
  applySkipRefineToPipeline,
  createRiverMaskPipeline,
  getRiverMaskStageFromContext,
  requireRiverMaskStageFromContext,
  resolveDisplayRiverNetworkMask,
  resolveDisplayRiverNetworkMaskFromPipeline,
  RIVER_MASK_LIFECYCLE_ORDER,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  riverMaskContractKey,
  riverMasksEqual,
  snapshotRiverMaskLifecycle,
  snapshotRiverMaskPipeline,
} from './riverMaskLifecycle.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [fill]
 */
function flatLand(width, height, fill = 0.6) {
  return new Float32Array(width * height).fill(fill)
}

/**
 * @param {number} width
 * @param {number} height
 */
function noOcean(width, height) {
  return new Array(width * height).fill(false)
}

test('routeFractalCorridorPath connects endpoints on a low saddle', () => {
  const width = 20
  const height = 12
  const elevation = flatLand(width, height, 0.72)
  const ocean = noOcean(width, height)
  const fromIdx = 5 * width + 2
  const toIdx = 5 * width + 17
  for (let x = 8; x <= 11; x += 1) {
    elevation[5 * width + x] = 0.45
    elevation[6 * width + x] = 0.44
  }

  const random = createSeededRandom(deriveFieldSeed(42, 'route-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'legacyAttraction',
    requireDescent: true,
  })

  assert.ok(path)
  assert.strictEqual(path[0], fromIdx)
  assert.strictEqual(path.at(-1), toIdx)
})

test('routeFractalCorridorPath returns null when descent is required but path climbs', () => {
  const width = 12
  const height = 8
  const elevation = flatLand(width, height, 0.5)
  const ocean = noOcean(width, height)
  const fromIdx = 3 * width + 2
  const toIdx = 3 * width + 9
  elevation[fromIdx] = 0.4
  elevation[toIdx] = 0.8

  const random = createSeededRandom(deriveFieldSeed(7, 'climb-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'legacyAttraction',
    requireDescent: true,
  })

  assert.strictEqual(path, null)
  assert.equal(corridorPathDescends([fromIdx, toIdx], elevation), false)
})

test('routeFractalCorridorPath meander refine profile stays near sketch mask', () => {
  const width = 16
  const height = 16
  const elevation = flatLand(width, height, 0.65)
  const ocean = noOcean(width, height)
  const sketchMask = new Uint8Array(width * height)
  for (let x = 4; x <= 11; x += 1) {
    sketchMask[8 * width + x] = 1
  }
  const fromIdx = 8 * width + 4
  const toIdx = 8 * width + 11

  const random = createSeededRandom(deriveFieldSeed(99, 'refine-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'meanderRefine',
    wiggleScale: 0.5,
    sketchMask,
    allowSegmentGaps: true,
    useFallbackLine: true,
  })

  assert.ok(path)
  assert.ok(path.every((idx) => sketchMask[idx] === 1 || Math.abs((idx % width) - 8) <= 2))
})

test('findLeastResistancePath returns null when downhill-only routing is blocked', () => {
  const width = 10
  const height = 10
  const elevation = flatLand(width, height, 0.5)
  const ocean = noOcean(width, height)
  const fromIdx = 2 * width + 2
  const toIdx = 2 * width + 7

  for (let y = 0; y < height; y += 1) {
    elevation[y * width + 5] = 0.99
  }

  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    downhillOnly: true,
  })

  assert.strictEqual(path, null)
})

test('RIVER_MASK_LIFECYCLE_ORDER documents sketch through painted stages', () => {
  assert.deepStrictEqual(RIVER_MASK_LIFECYCLE_ORDER, [
    'sketch',
    'incised',
    'settled',
    'presentation',
    'painted',
  ])
  assert.strictEqual(RIVER_MASK_SKIP_REFINE_TRANSITION, 'skipRefine')
  assert.strictEqual(riverMaskContractKey('presentation'), 'riverMask.presentation')
})

test('resolveDisplayRiverNetworkMask prefers presentation over settled', () => {
  const settled = new Uint8Array([1, 0, 1])
  const presentation = new Uint8Array([0, 1, 0])
  assert.equal(resolveDisplayRiverNetworkMask(presentation, settled), presentation)
  assert.equal(resolveDisplayRiverNetworkMask(null, settled), settled)
})

test('applySkipRefineTransition copies settled mask to presentation', () => {
  const settled = new Uint8Array([1, 0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled })
  applySkipRefineTransition({ riverMaskPipeline: pipeline })
  assert.ok(riverMasksEqual(pipeline.presentation, settled))
  assert.equal(pipeline.presentation, settled)
})

test('applySkipRefineToPipeline copies settled mask to presentation', () => {
  const settled = new Uint8Array([1, 0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled })
  applySkipRefineToPipeline(pipeline)
  assert.equal(pipeline.presentation, settled)
})

test('resolveDisplayRiverNetworkMaskFromPipeline prefers presentation over settled', () => {
  const settled = new Uint8Array([1, 0, 1])
  const presentation = new Uint8Array([0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled, presentation })
  assert.equal(resolveDisplayRiverNetworkMaskFromPipeline(pipeline), presentation)
})

test('snapshotRiverMaskPipeline captures mask fields by stage', () => {
  const sketch = new Uint8Array([1])
  const settled = new Uint8Array([0])
  const snapshot = snapshotRiverMaskPipeline(
    createRiverMaskPipeline({ sketch, settled }),
  )
  assert.equal(snapshot.sketch, sketch)
  assert.strictEqual(snapshot.incised, null)
  assert.equal(snapshot.settled, settled)
})

test('snapshotRiverMaskLifecycle captures mask fields by stage', () => {
  const sketch = new Uint8Array([1])
  const settled = new Uint8Array([0])
  const snapshot = snapshotRiverMaskLifecycle({
    riverMaskPipeline: createRiverMaskPipeline({ sketch, settled }),
  })
  assert.equal(snapshot.sketch, sketch)
  assert.strictEqual(snapshot.incised, null)
  assert.equal(snapshot.settled, settled)
})

test('getRiverMaskStageFromContext reads pipeline stage from hydrology context', () => {
  const sketch = new Uint8Array([1, 0])
  const ctx = { riverMaskPipeline: createRiverMaskPipeline({ sketch }) }
  assert.equal(getRiverMaskStageFromContext(ctx, 'sketch'), sketch)
  assert.strictEqual(getRiverMaskStageFromContext(ctx, 'incised'), null)
})

test('requireRiverMaskStageFromContext throws when stage is missing', () => {
  const ctx = { riverMaskPipeline: createRiverMaskPipeline() }
  assert.throws(
    () => requireRiverMaskStageFromContext(ctx, 'sketch'),
    /river mask stage sketch required/,
  )
})

test('riverMaskContractKey names pipeline stages for substep contracts', () => {
  assert.strictEqual(riverMaskContractKey('sketch'), 'riverMask.sketch')
  assert.strictEqual(riverMaskContractKey('painted'), 'riverMask.painted')
})
