import assert from 'node:assert/strict'
import test from 'node:test'
import {
  angleDegrees,
  findLeastResistancePath,
  normalizeVector,
  unitVector,
} from './riverPathfinding.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [fill]
 */
function flatLand(width, height, fill = 0.6) {
  return new Float32Array(width * height).fill(fill)
}

/**
 * @param {number} width
 * @param {number} height
 */
function noOcean(width, height) {
  return new Array(width * height).fill(false)
}

test('unitVector and normalizeVector return unit-length directions', () => {
  const width = 10
  const fromIdx = 2 * width + 2
  const toIdx = 2 * width + 5
  const direction = unitVector(fromIdx, toIdx, width)
  const normalized = normalizeVector({ x: 3, y: 4 })

  assert.ok(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-6)
  assert.ok(Math.abs(Math.hypot(normalized.x, normalized.y) - 1) < 1e-6)
  assert.ok(Math.abs(normalizeVector({ x: 0, y: 0 }).x) <= 1)
})

test('angleDegrees measures turn between path segments', () => {
  const width = 10
  const right = unitVector(2 * width + 2, 2 * width + 5, width)
  const left = unitVector(2 * width + 2, 2 * width + 0, width)

  assert.ok(angleDegrees(right, left) > 150)
  assert.ok(angleDegrees(right, right) < 1e-6)
})

test('findLeastResistancePath routes around a hill between endpoints', () => {
  const width = 12
  const height = 8
  const elevation = flatLand(width, height)
  const ocean = noOcean(width, height)
  const fromIdx = 3 * width + 1
  const toIdx = 3 * width + 10
  elevation[3 * width + 5] = 0.95
  elevation[3 * width + 6] = 0.95

  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
  })

  assert.ok(path)
  assert.strictEqual(path[0], fromIdx)
  assert.strictEqual(path.at(-1), toIdx)
  assert.ok(!path.includes(3 * width + 5))
})

test('findLeastResistancePath accepts preferredArrivalDir without blocking reachability', () => {
  const width = 20
  const height = 5
  const elevation = flatLand(width, height, 0.55)
  const ocean = noOcean(width, height)
  const fromIdx = 2 * width + 2
  const toIdx = 2 * width + 17

  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    preferredArrivalDir: { x: 0, y: 1 },
  })

  assert.ok(path)
  assert.strictEqual(path.at(-1), toIdx)
})

test('findLeastResistancePath returns null when destination is unreachable', () => {
  const width = 10
  const height = 10
  const elevation = flatLand(width, height, 0.5)
  const ocean = noOcean(width, height)
  const fromIdx = 2 * width + 2
  const toIdx = 2 * width + 7

  for (let y = 0; y < height; y += 1) {
    elevation[y * width + 5] = 0.99
  }

  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    downhillOnly: true,
  })

  assert.strictEqual(path, null)
})

test('findLeastResistancePath stops searching after the visit budget on large grids', () => {
  const width = 64
  const height = 64
  const elevation = flatLand(width, height, 0.55)
  const ocean = noOcean(width, height)
  const fromIdx = 4 * width + 4
  const toIdx = 58 * width + 58

  for (let y = 0; y < height; y += 1) {
    for (let x = 20; x < 44; x += 1) {
      elevation[y * width + x] = 0.98
    }
  }

  const start = performance.now()
  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    downhillOnly: true,
  })
  const elapsedMs = performance.now() - start

  assert.strictEqual(path, null)
  assert.ok(elapsedMs < 500, `pathfinding exceeded visit budget (${elapsedMs.toFixed(1)}ms)`)
})
