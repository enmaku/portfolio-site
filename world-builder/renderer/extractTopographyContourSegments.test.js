import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../core/biomeIds.js'
import { extractTopographyContourSegments } from './extractTopographyContourSegments.js'

test('extractTopographyContourSegments returns no segments for flat ocean', () => {
  const segments = extractTopographyContourSegments({
    elevation: new Float32Array(16).fill(0.2),
    width: 4,
    height: 4,
  })

  assert.strictEqual(segments.length, 0)
})

test('extractTopographyContourSegments traces contours around elevated land', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(0.3)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - 16
      const dy = y - 16
      const distance = Math.hypot(dx, dy)
      if (distance < 12) {
        elevation[y * width + x] = SEA_LEVEL + 0.08 + ((12 - distance) / 12) * 0.45
      }
    }
  }

  const segments = extractTopographyContourSegments({
    elevation,
    width,
    height,
    stride: 1,
  })

  assert.ok(segments.length > 20)
  assert.ok(segments.every((segment) => segment.x0 >= 0 && segment.y0 >= 0))
})

test('extractTopographyContourSegments is deterministic for the same field', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.55)
  elevation[7 * width + 7] = 0.92

  const first = extractTopographyContourSegments({ elevation, width, height, stride: 1 })
  const second = extractTopographyContourSegments({ elevation, width, height, stride: 1 })

  assert.deepStrictEqual(first, second)
})
