import assert from 'node:assert/strict'
import test from 'node:test'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { DEFAULT_BREACH_THRESHOLD } from '../worldGenerationOptions.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { fillLakes } from './fillLakes.js'

function makeBowlElevation(width, height, bowlRadius, rimElev, floorElev) {
  const elevation = new Float32Array(width * height)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      elevation[y * width + x] =
        dist <= bowlRadius ? floorElev : rimElev
    }
  }
  return elevation
}

/** @param {number} x @param {number} y @param {number} width */
function idx(x, y, width) {
  return y * width + x
}

/**
 * Closed rectangular depression with a single saddle cell on the north rim.
 * @param {number} saddleElev
 */
function makeSaddleBasinGrid(saddleElev) {
  const width = 9
  const height = 9
  const rimElev = 0.9
  const elevation = new Float32Array(width * height).fill(rimElev)
  for (let y = 2; y <= 6; y += 1) {
    for (let x = 2; x <= 6; x += 1) {
      elevation[idx(x, y, width)] = 0.2
    }
  }
  elevation[idx(4, 1, width)] = saddleElev
  const ocean = Array.from({ length: width * height }, () => false)
  return { width, height, elevation, ocean }
}

test('fillLakes fills synthetic bowl depression', () => {
  const width = 32
  const height = 32
  const elevation = makeBowlElevation(width, height, 6, 0.65, 0.42)
  const ocean = isOceanCell(elevation, width, height)
  const { lakeMask, lakes } = fillLakes({ elevation, width, height, ocean })

  assert.ok(lakes.length >= 1)
  const lakeCells = lakeMask.reduce((sum, cell) => sum + cell, 0)
  assert.ok(lakeCells > 0 || lakes[0].endorheic === false)
})

test('fillLakes ignores tiny depressions', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.6)
  elevation[8 * width + 8] = 0.55
  const ocean = isOceanCell(elevation, width, height)
  const { lakes } = fillLakes({ elevation, width, height, ocean })
  assert.strictEqual(lakes.length, 0)
})

test('fillLakes breaches low saddle when spill depth is shallow relative to basin depth', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.88)
  const { lakes, lakeMeta, filledElevation } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.strictEqual(lakes.length, 1)
  assert.strictEqual(lakeMeta.length, 1)
  assert.strictEqual(lakes[0].endorheic, false)
  assert.strictEqual(lakeMeta[0].endorheic, false)
  assert.strictEqual(lakeMeta[0].outletX, 4)
  assert.strictEqual(lakeMeta[0].outletY, 1)
  assert.ok(lakeMeta[0].surfaceElevation > 0.2)
  assert.ok(filledElevation[idx(4, 1, width)] < elevation[idx(4, 1, width)])
  assert.ok(filledElevation[idx(4, 4, width)] <= elevation[idx(4, 4, width)] + 1e-4)
})

test('fillLakes keeps high saddle basins endorheic', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const { lakes, lakeMeta, filledElevation } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.strictEqual(lakes.length, 1)
  assert.strictEqual(lakes[0].endorheic, true)
  assert.strictEqual(lakeMeta[0].endorheic, true)
  assert.strictEqual(lakeMeta[0].outletX, undefined)
  assert.strictEqual(lakeMeta[0].outletY, undefined)
  assert.ok(lakeMeta[0].surfaceElevation > elevation[idx(4, 4, width)])
  assert.ok(filledElevation[idx(4, 4, width)] > elevation[idx(4, 4, width)])
})

test('fillLakes breach evaluation is deterministic on fixed grids', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.88)
  const first = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })
  const second = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.deepStrictEqual(first.lakes, second.lakes)
  assert.deepStrictEqual(first.lakeMeta, second.lakeMeta)
  assert.deepStrictEqual(first.filledElevation, second.filledElevation)
  assert.strictEqual(first.breachCount, second.breachCount)
  assert.strictEqual(first.endorheicCount, second.endorheicCount)
})

test('fillLakes breachThreshold toggles classification on the same grid', () => {
  const grid = makeSaddleBasinGrid(0.88)
  const common = { ...grid, minLakeAreaScale: 0.01 }

  const breached = fillLakes({ ...common, breachThreshold: 1 })
  const endorheic = fillLakes({ ...common, breachThreshold: 0 })

  assert.strictEqual(breached.lakes[0].endorheic, false)
  assert.strictEqual(endorheic.lakes[0].endorheic, true)
  assert.strictEqual(breached.breachCount, 1)
  assert.strictEqual(endorheic.endorheicCount, 1)
})

test('fillLakes breached outlet enables flow to leave the basin', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.88)
  const { filledElevation, lakeMeta } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.strictEqual(lakeMeta[0].endorheic, false)
  const outletIdx = idx(lakeMeta[0].outletX, lakeMeta[0].outletY, width)
  assert.ok(filledElevation[outletIdx] < elevation[outletIdx])

  const { flowDirection } = computeFlowAccumulation({
    elevation: filledElevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })
  const westRimIdx = idx(3, 1, width)
  const eastRimIdx = idx(5, 1, width)
  assert.notStrictEqual(flowDirection[westRimIdx], -1)
  assert.notStrictEqual(flowDirection[eastRimIdx], -1)
})

test('fillLakes endorheic basin blocks outlet flow at filled surface', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const { filledElevation, lakeMeta } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.strictEqual(lakeMeta[0].endorheic, true)
  const pitIdx = idx(4, 4, width)
  assert.ok(filledElevation[pitIdx] > elevation[pitIdx])

  const { flowDirection } = computeFlowAccumulation({
    elevation: filledElevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })
  assert.strictEqual(flowDirection[pitIdx], -1)
})

test('fillLakes lakeMeta aligns with lakes records', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.88)
  const { lakes, lakeMeta } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
  })

  assert.strictEqual(lakeMeta.length, lakes.length)
  for (let i = 0; i < lakes.length; i += 1) {
    assert.strictEqual(lakeMeta[i].endorheic, lakes[i].endorheic)
    assert.strictEqual(typeof lakeMeta[i].surfaceElevation, 'number')
  }
})

test('fillLakes reports breach and endorheic counts', () => {
  const low = makeSaddleBasinGrid(0.88)
  const high = makeSaddleBasinGrid(0.5)

  const breached = fillLakes({
    ...low,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })
  const endorheic = fillLakes({
    ...high,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  assert.strictEqual(breached.breachCount, 1)
  assert.strictEqual(breached.endorheicCount, 0)
  assert.strictEqual(endorheic.breachCount, 0)
  assert.strictEqual(endorheic.endorheicCount, 1)
})
