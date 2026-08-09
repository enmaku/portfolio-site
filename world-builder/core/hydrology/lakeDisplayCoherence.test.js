import assert from 'node:assert/strict'
import test from 'node:test'
import { assertLakeMaskSurfacesMatchMeta } from './lakeDisplayCoherence.js'

/** @param {number} x @param {number} y @param {number} width */
function idx(x, y, width) {
  return y * width + x
}

test('assertLakeMaskSurfacesMatchMeta passes for flat aligned lake surfaces', () => {
  const width = 7
  const height = 5
  const lakeMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.9)

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.55
    }
  }

  const lakes = [{ id: 0, area: 9, endorheic: true }]
  const lakeMeta = [{ endorheic: true, surfaceElevation: 0.55 }]

  assertLakeMaskSurfacesMatchMeta({
    lakeMask,
    lakes,
    lakeMeta,
    elevation,
    width,
    height,
  })
})

test('assertLakeMaskSurfacesMatchMeta rejects uneven lake cell elevations', () => {
  const width = 5
  const height = 5
  const lakeMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.9)

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.55
    }
  }
  elevation[idx(2, 2, width)] = 0.48

  const lakes = [{ id: 0, area: 9, endorheic: true }]
  const lakeMeta = [{ endorheic: true, surfaceElevation: 0.55 }]

  assert.throws(
    () =>
      assertLakeMaskSurfacesMatchMeta({
        lakeMask,
        lakes,
        lakeMeta,
        elevation,
        width,
        height,
      }),
    /AssertionError/,
  )
})

test('assertLakeMaskSurfacesMatchMeta rejects surfaces diverging from lakeMeta', () => {
  const width = 5
  const height = 5
  const lakeMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.9)

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.55
    }
  }

  const lakes = [{ id: 0, area: 9, endorheic: true }]
  const lakeMeta = [{ endorheic: true, surfaceElevation: 0.62 }]

  assert.throws(
    () =>
      assertLakeMaskSurfacesMatchMeta({
        lakeMask,
        lakes,
        lakeMeta,
        elevation,
        width,
        height,
      }),
    /AssertionError/,
  )
})

test('assertLakeMaskSurfacesMatchMeta maps spill-adjacent components to lake records', () => {
  const width = 11
  const height = 7
  const lakeMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.95)
  const ocean = Array.from({ length: width * height }, () => false)
  ocean[idx(0, 3, width)] = true

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 7; x <= 9; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.68
    }
  }
  elevation[idx(6, 3, width)] = 0.68

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.41
    }
  }

  const lakes = [
    { id: 0, area: 9, endorheic: false, spillX: 6, spillY: 3 },
    { id: 1, area: 9, endorheic: true },
  ]
  const lakeMeta = [
    { endorheic: false, surfaceElevation: 0.68 },
    { endorheic: true, surfaceElevation: 0.41 },
  ]

  assertLakeMaskSurfacesMatchMeta({
    lakeMask,
    lakes,
    lakeMeta,
    elevation,
    width,
    height,
  })

  assert.strictEqual(ocean[idx(0, 3, width)], true)
})

test('assertLakeMaskSurfacesMatchMeta rejects unmapped lake-mask components', () => {
  const width = 9
  const height = 5
  const lakeMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.9)

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.55
    }
  }
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 6; x <= 8; x += 1) {
      lakeMask[idx(x, y, width)] = 1
      elevation[idx(x, y, width)] = 0.48
    }
  }

  const lakes = [{ id: 0, area: 9, endorheic: true }]
  const lakeMeta = [{ endorheic: true, surfaceElevation: 0.55 }]

  assert.throws(
    () =>
      assertLakeMaskSurfacesMatchMeta({
        lakeMask,
        lakes,
        lakeMeta,
        elevation,
        width,
        height,
      }),
    /lake-mask component 1 must map to a lake record/,
  )
})
