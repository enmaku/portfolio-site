import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { computeCoastNavigability } from './computeCoastNavigability.js'

test('computeCoastNavigability is zero on interior land cells', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.3)

  const navigability = computeCoastNavigability({ elevation, width, height })

  assert.strictEqual(navigability[2 * width + 2], 0)
  assert.strictEqual(navigability[width + 2], 0)
})

test('computeCoastNavigability increases with ocean depth', () => {
  const width = 3
  const height = 1
  const elevation = new Float32Array([SEA_LEVEL - 0.05, SEA_LEVEL - 0.2, SEA_LEVEL - 0.4])

  const navigability = computeCoastNavigability({ elevation, width, height })

  assert.ok(navigability[2] > navigability[1])
  assert.ok(navigability[1] > navigability[0])
})

test('computeCoastNavigability favors sheltered bays beside tall coast', () => {
  const width = 5
  const height = 3
  const shelteredElevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.1)
  shelteredElevation[1 * width + 1] = SEA_LEVEL + 0.25
  shelteredElevation[1 * width + 3] = SEA_LEVEL + 0.25
  const exposedElevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.1)

  const sheltered = computeCoastNavigability({ elevation: shelteredElevation, width, height })
  const exposed = computeCoastNavigability({ elevation: exposedElevation, width, height })

  assert.ok(sheltered[1 * width + 2] > exposed[1 * width + 2])
})

test('computeCoastNavigability stays within normalized range on mixed coast', () => {
  const width = 6
  const height = 6
  const elevation = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      elevation[idx] = x < 3 ? SEA_LEVEL + 0.15 : SEA_LEVEL - 0.1 - x * 0.01
    }
  }

  const navigability = computeCoastNavigability({ elevation, width, height })
  for (const value of navigability) {
    assert.ok(value >= 0 && value <= 1)
  }
  assert.ok(navigability.some((value) => value > 0))
})
