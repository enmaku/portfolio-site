import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { seedHaulShedVisited } from '../visitStatus/visitRaster.js'
import {
  EXPLORATION_TARGET_ATTEMPTS,
  pickExplorationTarget,
} from './pickExplorationTarget.js'

test('pickExplorationTarget returns an unvisited cell beyond the haul-shed without scanning the grid', () => {
  const gridWidth = 64
  const gridHeight = 64
  const visitRaster = new Uint8Array(gridWidth * gridHeight)
  visitRaster[32 * gridWidth + 32] = 1

  const random = createSeededRandom(deriveFieldSeed(99, 'bearing-test'))
  const target = pickExplorationTarget({
    doc: { gridWidth, gridHeight },
    visitRaster,
    settlement: { x: 32, y: 32 },
    random,
    horizonCells: 12,
  })

  assert.ok(target)
  assert.strictEqual(visitRaster[target.y * gridWidth + target.x], 0)
  const distance = Math.hypot(target.x - 32, target.y - 32)
  assert.ok(distance >= 12)
  assert.ok(distance <= 36)
})

test('pickExplorationTarget finds a target after the founding haul-shed is seeded', () => {
  const gridWidth = 64
  const gridHeight = 64
  const visitRaster = new Uint8Array(gridWidth * gridHeight)
  const movementCost = new Float32Array(gridWidth * gridHeight).fill(1)
  seedHaulShedVisited(visitRaster, {
    origin: { x: 32, y: 32 },
    budget: 10,
    gridWidth,
    gridHeight,
    movementCost,
  })

  const random = createSeededRandom(deriveFieldSeed(7, 'haul-shed-frontier'))
  const target = pickExplorationTarget({
    doc: { gridWidth, gridHeight },
    visitRaster,
    settlement: { x: 32, y: 32 },
    random,
    horizonCells: 10,
  })

  assert.ok(target)
  assert.strictEqual(visitRaster[target.y * gridWidth + target.x], 0)
})

test('pickExplorationTarget returns null when every cell in reach is visited', () => {
  const gridWidth = 8
  const gridHeight = 8
  const visitRaster = new Uint8Array(gridWidth * gridHeight).fill(1)
  const random = createSeededRandom(2)
  const target = pickExplorationTarget({
    doc: { gridWidth, gridHeight },
    visitRaster,
    settlement: { x: 4, y: 4 },
    random,
    horizonCells: 2,
  })
  assert.strictEqual(target, null)
})

test('pickExplorationTarget uses at most EXPLORATION_TARGET_ATTEMPTS bearings', () => {
  const gridWidth = 8
  const gridHeight = 8
  const visitRaster = new Uint8Array(gridWidth * gridHeight).fill(1)
  let draws = 0
  const random = () => {
    draws += 1
    return 0.5
  }
  pickExplorationTarget({
    doc: { gridWidth, gridHeight },
    visitRaster,
    settlement: { x: 4, y: 4 },
    random,
    horizonCells: 2,
  })
  assert.ok(draws <= EXPLORATION_TARGET_ATTEMPTS * 2)
})
