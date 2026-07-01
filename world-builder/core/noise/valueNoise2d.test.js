import assert from 'node:assert/strict'
import test from 'node:test'
import { generateFbm2d } from './fbm2d.js'
import { sampleValueNoise2d } from './valueNoise2d.js'

test('sampleValueNoise2d is deterministic for the same coordinates and seed', () => {
  const first = sampleValueNoise2d(12.5, 7.25, 4242)
  const second = sampleValueNoise2d(12.5, 7.25, 4242)
  assert.strictEqual(first, second)
})

test('sampleValueNoise2d returns values in [0, 1]', () => {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const value = sampleValueNoise2d(x * 0.37, y * 0.29, 9001)
      assert.ok(value >= 0 && value <= 1, `out of range at (${x}, ${y}): ${value}`)
    }
  }
})

test('sampleValueNoise2d matches legacy fbm2d lattice sampling', () => {
  const width = 12
  const height = 10
  const seed = 1337
  const frequency = 0.012

  const fbm = generateFbm2d({
    width,
    height,
    seed,
    octaves: 1,
    frequency,
    lacunarity: 2,
    persistence: 0.5,
  })

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const expected = sampleValueNoise2d(x * frequency, y * frequency, seed)
      assert.ok(
        Math.abs(fbm[y * width + x] - expected) < 1e-6,
        `mismatch at (${x}, ${y})`,
      )
    }
  }
})
