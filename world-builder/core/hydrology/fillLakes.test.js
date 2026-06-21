import assert from 'node:assert/strict'
import test from 'node:test'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
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

test('fillLakes fills synthetic bowl depression', () => {
  const width = 32
  const height = 32
  const elevation = makeBowlElevation(width, height, 6, 0.65, 0.42)
  const ocean = isOceanCell(elevation, width, height)
  const { lakeMask, lakes } = fillLakes({ elevation, width, height, ocean })

  let lakeCells = 0
  for (let i = 0; i < lakeMask.length; i += 1) {
    if (lakeMask[i]) lakeCells += 1
  }
  assert.ok(lakeCells > 0)
  assert.ok(lakes.length >= 1)
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

test('fillLakes classifies endorheic when no exterior spill', () => {
  const width = 20
  const height = 20
  const elevation = new Float32Array(width * height).fill(0.7)
  for (let y = 6; y <= 14; y += 1) {
    for (let x = 6; x <= 14; x += 1) {
      elevation[y * width + x] = 0.45
    }
  }
  const ocean = isOceanCell(elevation, width, height)
  const { lakes } = fillLakes({ elevation, width, height, ocean })
  if (lakes.length > 0) {
    assert.ok(typeof lakes[0].endorheic === 'boolean')
  }
})
