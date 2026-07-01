import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { deriveSalinityFromOcean } from './deriveSalinityFromOcean.js'

test('deriveSalinityFromOcean is 1 at ocean and rim', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.6)

  elevation[2 * width + 2] = 0.1

  const salinity = deriveSalinityFromOcean({ elevation, width, height })

  assert.ok(salinity[0] >= 0.99)
  assert.ok(salinity[width - 1] >= 0.99)
  assert.ok(salinity[2 * width + 2] >= 0.99)
})

test('deriveSalinityFromOcean tapers with distance from coast', () => {
  const width = 25
  const height = 25
  const elevation = new Float32Array(width * height).fill(0.55)
  for (let y = 0; y < height; y += 1) {
    elevation[y * width] = 0.1
  }

  const salinity = deriveSalinityFromOcean({ elevation, width, height })
  const row = 12

  assert.ok(salinity[row * width + 3] > salinity[row * width + 9])
})

test('deriveSalinityFromOcean respects active sea level', () => {
  const width = 11
  const height = 11
  const seaLevel = 0.5
  const elevation = new Float32Array(width * height).fill(0.55)
  elevation[5 * width + 5] = 0.45

  const salinity = deriveSalinityFromOcean({ elevation, width, height, seaLevel })

  assert.ok(salinity[5 * width + 5] >= 0.99)
  assert.ok(salinity[5 * width + 6] < salinity[5 * width + 5])
})

test('deriveSalinityFromOcean defaults sea level to pipeline constant', () => {
  const width = 7
  const height = 7
  const elevation = new Float32Array(width * height).fill(0.6)
  elevation[3 * width + 3] = SEA_LEVEL - 0.05

  const salinity = deriveSalinityFromOcean({ elevation, width, height })

  assert.ok(salinity[3 * width + 3] >= 0.99)
})
