import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHaulShedIsochrone } from './computeHaulShedIsochrone.js'

test('computeHaulShedIsochrone uses circle fallback when movement cost is absent', () => {
  const cells = computeHaulShedIsochrone({
    origin: { x: 5, y: 5 },
    budget: 2,
    gridWidth: 11,
    gridHeight: 11,
  })

  assert.ok(cells.some((cell) => cell.x === 5 && cell.y === 5))
  assert.ok(cells.some((cell) => cell.x === 7 && cell.y === 5))
  assert.ok(!cells.some((cell) => cell.x === 8 && cell.y === 5))
})

test('computeHaulShedIsochrone uses circle fallback when movement cost length mismatches grid', () => {
  const cells = computeHaulShedIsochrone({
    origin: { x: 2, y: 2 },
    budget: 1,
    gridWidth: 5,
    gridHeight: 5,
    movementCost: new Float32Array(3).fill(1),
  })

  assert.ok(cells.some((cell) => cell.x === 2 && cell.y === 2))
  assert.ok(cells.some((cell) => cell.x === 3 && cell.y === 2))
  assert.ok(!cells.some((cell) => cell.x === 4 && cell.y === 2))
})

test('computeHaulShedIsochrone shrinks when uphill cost exhausts budget', () => {
  const gridWidth = 5
  const gridHeight = 1
  const flat = new Float32Array(gridWidth).fill(1)
  const uphill = new Float32Array(gridWidth).fill(1)
  uphill[2] = 10
  uphill[3] = 10
  uphill[4] = 10

  const flatCells = computeHaulShedIsochrone({
    origin: { x: 0, y: 0 },
    budget: 4,
    gridWidth,
    gridHeight,
    movementCost: flat,
  })
  const uphillCells = computeHaulShedIsochrone({
    origin: { x: 0, y: 0 },
    budget: 4,
    gridWidth,
    gridHeight,
    movementCost: uphill,
  })

  assert.ok(flatCells.length > uphillCells.length)
  assert.ok(flatCells.some((cell) => cell.x === 4))
  assert.ok(!uphillCells.some((cell) => cell.x === 4))
})
