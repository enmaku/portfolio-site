import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_BREACH_THRESHOLD } from '../worldGenerationOptions.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { fillLakes } from './fillLakes.js'
import { assertLakeMaskSurfacesMatchMeta } from './lakeDisplayCoherence.js'
import { settleLakeEquilibrium } from './settleLakeEquilibrium.js'

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

/**
 * @param {Float32Array} elevation
 * @param {Uint8Array} lakeMask
 */
function lakeCellElevations(elevation, lakeMask) {
  /** @type {number[]} */
  const values = []
  for (let i = 0; i < lakeMask.length; i += 1) {
    if (lakeMask[i]) values.push(elevation[i])
  }
  return values
}

test('settleLakeEquilibrium normalizes disturbed endorheic lake surfaces', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const filled = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  const disturbed = new Float32Array(filled.filledElevation)
  for (let i = 0; i < disturbed.length; i += 1) {
    if (filled.lakeMask[i]) {
      disturbed[i] -= 0.08
    }
  }

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask: filled.lakeMask,
    lakes: filled.lakes,
    lakeMeta: filled.lakeMeta,
    ocean,
    width,
    height,
  })

  const lakeElevs = lakeCellElevations(settled.elevation, filled.lakeMask)
  assert.ok(lakeElevs.length > 0)
  const surface = lakeElevs[0]
  for (const value of lakeElevs) {
    assert.ok(Math.abs(value - surface) < 1e-5)
  }
  assert.ok(Math.abs(settled.lakeMeta[0].surfaceElevation - surface) < 1e-5)
  assert.strictEqual(settled.lakeMeta[0].endorheic, true)
})

test('settleLakeEquilibrium keeps endorheic basins closed after disturbance', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const filled = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  const disturbed = new Float32Array(filled.filledElevation)
  for (let i = 0; i < disturbed.length; i += 1) {
    if (filled.lakeMask[i]) {
      disturbed[i] -= 0.05
    }
  }

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask: filled.lakeMask,
    lakes: filled.lakes,
    lakeMeta: filled.lakeMeta,
    ocean,
    width,
    height,
  })

  const pitIdx = idx(4, 4, width)
  const { flowDirection } = computeFlowAccumulation({
    elevation: settled.elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })
  assert.strictEqual(flowDirection[pitIdx], -1)
})

test('settleLakeEquilibrium preserves breached outlet connectivity', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.88)
  const filled = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  const disturbed = new Float32Array(filled.filledElevation)
  const outletIdx = idx(filled.lakeMeta[0].outletX, filled.lakeMeta[0].outletY, width)
  disturbed[outletIdx] = filled.filledElevation[outletIdx] + 0.06

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask: filled.lakeMask,
    lakes: filled.lakes,
    lakeMeta: filled.lakeMeta,
    ocean,
    width,
    height,
  })

  assert.strictEqual(settled.lakeMeta[0].endorheic, false)
  assert.ok(settled.elevation[outletIdx] < elevation[outletIdx])
  const { flowDirection } = computeFlowAccumulation({
    elevation: settled.elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })
  assert.notStrictEqual(flowDirection[idx(3, 1, width)], -1)
})

test('settleLakeEquilibrium refreshes ocean spill coordinates after rim disturbance', () => {
  const width = 9
  const height = 7
  const elevation = new Float32Array(width * height).fill(0.9)
  const lakeMask = new Uint8Array(width * height)
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.55
    }
  }
  elevation[idx(2, 3, width)] = 0.72
  const ocean = Array.from({ length: width * height }, () => false)
  ocean[idx(0, 3, width)] = true
  ocean[idx(1, 3, width)] = true

  const lakes = [
    {
      id: 0,
      area: 9,
      endorheic: false,
      spillX: 2,
      spillY: 3,
    },
  ]
  const lakeMeta = [
    {
      endorheic: false,
      surfaceElevation: 0.55,
    },
  ]
  const disturbed = new Float32Array(elevation)
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      disturbed[idx(x, y, width)] -= 0.05
    }
  }
  disturbed[idx(2, 3, width)] = 0.78

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask,
    lakes,
    lakeMeta,
    ocean,
    width,
    height,
  })

  assert.strictEqual(typeof settled.lakes[0].spillX, 'number')
  assert.strictEqual(typeof settled.lakes[0].spillY, 'number')

  const lakeElevs = lakeCellElevations(settled.elevation, lakeMask)
  const surface = lakeElevs[0]
  for (const value of lakeElevs) {
    assert.ok(Math.abs(value - surface) < 1e-5)
  }
  assert.ok(Math.abs(settled.lakeMeta[0].surfaceElevation - surface) < 1e-5)
})

test('settleLakeEquilibrium matches lake records when breach shifts lake ids', () => {
  const width = 15
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.95)
  const lakeMask = new Uint8Array(width * height)
  const ocean = Array.from({ length: width * height }, () => false)
  ocean[idx(0, 4, width)] = true

  for (let y = 3; y <= 5; y += 1) {
    for (let x = 8; x <= 10; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.52
    }
  }
  elevation[idx(7, 4, width)] = 0.68

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.41
    }
  }

  const lakes = [
    { id: 0, area: 12, endorheic: false },
    { id: 1, area: 9, endorheic: false, spillX: 7, spillY: 4 },
    { id: 2, area: 9, endorheic: true },
  ]
  const lakeMeta = [
    { endorheic: false, surfaceElevation: 0.35 },
    { endorheic: false, surfaceElevation: 0.68 },
    { endorheic: true, surfaceElevation: 0.41 },
  ]

  const disturbed = new Float32Array(elevation)
  for (let i = 0; i < disturbed.length; i += 1) {
    if (lakeMask[i]) disturbed[i] -= 0.04
  }
  disturbed[idx(7, 4, width)] = 0.74

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask,
    lakes,
    lakeMeta,
    ocean,
    width,
    height,
  })

  /** @type {number[]} */
  const spillLakeCells = []
  /** @type {number[]} */
  const endorheicCells = []
  for (let i = 0; i < lakeMask.length; i += 1) {
    if (!lakeMask[i]) continue
    const x = i % width
    const y = Math.floor(i / width)
    if (x >= 8 && x <= 10 && y >= 3 && y <= 5) spillLakeCells.push(i)
    else endorheicCells.push(i)
  }

  for (const cellIdx of spillLakeCells) {
    assert.ok(Math.abs(settled.elevation[cellIdx] - settled.lakeMeta[1].surfaceElevation) < 1e-5)
  }
  for (const cellIdx of endorheicCells) {
    assert.ok(Math.abs(settled.elevation[cellIdx] - settled.lakeMeta[2].surfaceElevation) < 1e-5)
  }
  assert.strictEqual(settled.lakeMeta[2].endorheic, true)
  assert.strictEqual(settled.lakeMeta[1].endorheic, false)
})

test('settleLakeEquilibrium output passes lake display coherence checks', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const filled = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })

  const disturbed = new Float32Array(filled.filledElevation)
  for (let i = 0; i < disturbed.length; i += 1) {
    if (filled.lakeMask[i]) disturbed[i] -= 0.04
  }

  const settled = settleLakeEquilibrium({
    elevation: disturbed,
    lakeMask: filled.lakeMask,
    lakes: filled.lakes,
    lakeMeta: filled.lakeMeta,
    ocean,
    width,
    height,
  })

  assertLakeMaskSurfacesMatchMeta({
    lakeMask: filled.lakeMask,
    lakes: settled.lakes,
    lakeMeta: settled.lakeMeta,
    elevation: settled.elevation,
    width,
    height,
  })
})

test('settleLakeEquilibrium is deterministic on fixed grids', () => {
  const { width, height, elevation, ocean } = makeSaddleBasinGrid(0.5)
  const filled = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
    breachThreshold: DEFAULT_BREACH_THRESHOLD,
  })
  const disturbed = new Float32Array(filled.filledElevation)
  for (let i = 0; i < disturbed.length; i += 1) {
    if (filled.lakeMask[i]) disturbed[i] -= 0.03
  }

  const common = {
    elevation: disturbed,
    lakeMask: filled.lakeMask,
    lakes: filled.lakes,
    lakeMeta: filled.lakeMeta,
    ocean,
    width,
    height,
  }

  const first = settleLakeEquilibrium(common)
  const second = settleLakeEquilibrium(common)

  assert.deepStrictEqual(first.lakes, second.lakes)
  assert.deepStrictEqual(first.lakeMeta, second.lakeMeta)
  assert.deepStrictEqual(first.elevation, second.elevation)
})
