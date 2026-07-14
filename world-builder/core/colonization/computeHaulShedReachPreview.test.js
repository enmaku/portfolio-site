import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHaulShedReachPreview } from './computeHaulShedReachPreview.js'

test('computeHaulShedReachPreview uses circle fallback when movement cost is absent', () => {
  const cells = computeHaulShedReachPreview({
    origin: { x: 5, y: 5 },
    threeDayHaulDistance: 2,
    gridWidth: 11,
    gridHeight: 11,
  })

  assert.ok(cells.some((cell) => cell.x === 5 && cell.y === 5))
  assert.ok(cells.some((cell) => cell.x === 7 && cell.y === 5))
  assert.ok(!cells.some((cell) => cell.x === 8 && cell.y === 5))
})

test('computeHaulShedReachPreview uses movement-cost isochrone when present', () => {
  const movementCost = new Float32Array(25).fill(1)
  // Block eastward travel from origin.
  movementCost[1 * 5 + 3] = 100
  movementCost[2 * 5 + 3] = 100
  movementCost[3 * 5 + 3] = 100

  const cells = computeHaulShedReachPreview({
    origin: { x: 1, y: 2 },
    threeDayHaulDistance: 3,
    gridWidth: 5,
    gridHeight: 5,
    movementCost,
  })

  assert.ok(cells.some((cell) => cell.x === 1 && cell.y === 2))
  assert.ok(cells.some((cell) => cell.x === 0 && cell.y === 2))
  assert.ok(!cells.some((cell) => cell.x === 4 && cell.y === 2))
})

test('computeHaulShedReachPreview rescales with three-day haul distance', () => {
  const small = computeHaulShedReachPreview({
    origin: { x: 10, y: 10 },
    threeDayHaulDistance: 1,
    gridWidth: 21,
    gridHeight: 21,
  })
  const large = computeHaulShedReachPreview({
    origin: { x: 10, y: 10 },
    threeDayHaulDistance: 4,
    gridWidth: 21,
    gridHeight: 21,
  })

  assert.ok(large.length > small.length)
})
