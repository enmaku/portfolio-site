import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveSalidityFromOcean } from './deriveSalidityFromOcean.js'

test('deriveSalidityFromOcean is 1 at ocean and rim', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.6)

  elevation[2 * width + 2] = 0.1

  const salidity = deriveSalidityFromOcean({ elevation, width, height })

  assert.ok(salidity[0] >= 0.99)
  assert.ok(salidity[width - 1] >= 0.99)
  assert.ok(salidity[2 * width + 2] >= 0.99)
})

test('deriveSalidityFromOcean tapers with distance from coast', () => {
  const width = 25
  const height = 25
  const elevation = new Float32Array(width * height).fill(0.55)
  for (let y = 0; y < height; y += 1) {
    elevation[y * width] = 0.1
  }

  const salidity = deriveSalidityFromOcean({ elevation, width, height })
  const row = 12

  assert.ok(salidity[row * width + 3] > salidity[row * width + 9])
})
