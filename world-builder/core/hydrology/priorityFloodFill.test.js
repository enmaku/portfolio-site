import assert from 'node:assert/strict'
import test from 'node:test'
import { priorityFloodFill } from './priorityFloodFill.js'

/** @param {number} x @param {number} y @param {number} width */
function cellIndex(x, y, width) {
  return y * width + x
}

/** @param {number} width @param {number} height @param {number} fill */
function makeOcean(width, height, fill = false) {
  return Array.from({ length: width * height }, () => fill)
}

test('priorityFloodFill raises a single pit to the lowest spill elevation', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(1)
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      elevation[cellIndex(x, y, width)] = 0.6
    }
  }
  elevation[cellIndex(2, 2, width)] = 0.2

  const ocean = makeOcean(width, height)
  const first = priorityFloodFill({ elevation, width, height, ocean, seaLevel: 0.5 })
  const second = priorityFloodFill({ elevation, width, height, ocean, seaLevel: 0.5 })

  assert.ok(first.filledElevation[cellIndex(2, 2, width)] >= 1 - 1e-5)
  assert.deepStrictEqual(first.filledElevation, second.filledElevation)
  assert.deepStrictEqual(first.spillOutlet, second.spillOutlet)

  const pitOutlet = first.spillOutlet[cellIndex(2, 2, width)]
  assert.ok(pitOutlet >= 0)
  const isBorderOutlet =
    pitOutlet % width === 0 ||
    pitOutlet % width === width - 1 ||
    Math.floor(pitOutlet / width) === 0 ||
    Math.floor(pitOutlet / width) === height - 1
  assert.ok(isBorderOutlet)
})

test('priorityFloodFill fills nested pits toward the outer spill in order', () => {
  const width = 7
  const height = 7
  const elevation = new Float32Array(width * height).fill(1)
  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 5; x += 1) {
      elevation[cellIndex(x, y, width)] = 0.7
    }
  }
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      elevation[cellIndex(x, y, width)] = 0.5
    }
  }
  elevation[cellIndex(3, 3, width)] = 0.2

  const ocean = makeOcean(width, height)
  const { filledElevation, spillOutlet } = priorityFloodFill({
    elevation,
    width,
    height,
    ocean,
    seaLevel: 0.5,
  })

  const innerPitIdx = cellIndex(3, 3, width)
  assert.ok(filledElevation[innerPitIdx] >= 0.5 - 1e-5)

  const innerOutlet = spillOutlet[innerPitIdx]
  assert.ok(innerOutlet >= 0)
  assert.ok(filledElevation[innerOutlet] >= 0.5 - 1e-5)

  const outerBasinIdx = cellIndex(1, 1, width)
  assert.ok(filledElevation[outerBasinIdx] >= 0.7 - 1e-5)
  assert.ok(filledElevation[spillOutlet[outerBasinIdx]] >= 0.7 - 1e-5)
})

test('priorityFloodFill drains plateau pits to the lowest reachable outlet', () => {
  const width = 7
  const height = 3
  const elevation = new Float32Array(width * height).fill(0.8)
  for (let y = 0; y < height; y += 1) {
    elevation[cellIndex(0, y, width)] = 0.6
  }
  elevation[cellIndex(3, 1, width)] = 0.74

  const ocean = makeOcean(width, height)
  const { filledElevation, spillOutlet } = priorityFloodFill({
    elevation,
    width,
    height,
    ocean,
    seaLevel: 0.5,
  })

  const pitIdx = cellIndex(3, 1, width)
  assert.ok(filledElevation[pitIdx] >= 0.8 - 1e-5)

  const outlet = spillOutlet[pitIdx]
  assert.strictEqual(outlet, cellIndex(2, 1, width))
  assert.ok(filledElevation[outlet] >= 0.8 - 1e-5)
})

test('priorityFloodFill treats ocean cells as boundary outlets at sea level', () => {
  const width = 4
  const height = 3
  const elevation = new Float32Array(width * height).fill(0.7)
  elevation[cellIndex(1, 1, width)] = 0.4
  const ocean = makeOcean(width, height)
  ocean[cellIndex(2, 1, width)] = true

  const { filledElevation, spillOutlet } = priorityFloodFill({
    elevation,
    width,
    height,
    ocean,
    seaLevel: 0.55,
  })

  const pitIdx = cellIndex(1, 1, width)
  const oceanIdx = cellIndex(2, 1, width)
  assert.ok(filledElevation[pitIdx] >= 0.55 - 1e-5)
  assert.strictEqual(spillOutlet[pitIdx], oceanIdx)
})
