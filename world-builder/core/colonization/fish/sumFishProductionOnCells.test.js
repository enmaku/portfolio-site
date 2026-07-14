import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../../biomeIds.js'
import {
  FISH_COLLAPSE_WEIGHT,
  FISH_PRODUCTIVITY_LAKE,
  FISH_PRODUCTIVITY_OCEAN,
  FISH_PRODUCTIVITY_RIVER,
  fishProductivityForCell,
  hinterlandFoodWeight,
  sumFishProductionOnCells,
} from './sumFishProductionOnCells.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {{
 *   ocean?: Array<[number, number]>,
 *   lake?: Array<[number, number]>,
 *   river?: Array<[number, number]>,
 * }} layout
 */
function waterDoc(width, height, layout = {}) {
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.1)
  const lakeMask = new Uint8Array(cellCount)
  const riverCorridorMask = new Uint8Array(cellCount)
  for (const [x, y] of layout.ocean ?? []) {
    elevation[y * width + x] = SEA_LEVEL - 0.05
  }
  for (const [x, y] of layout.lake ?? []) {
    lakeMask[y * width + x] = 1
  }
  for (const [x, y] of layout.river ?? []) {
    riverCorridorMask[y * width + x] = 1
  }
  return { gridWidth: width, gridHeight: height, elevation, lakeMask, riverCorridorMask }
}

test('fishProductivityForCell is zero for inland cells without water neighbors', () => {
  const doc = waterDoc(3, 3)
  assert.strictEqual(
    fishProductivityForCell({ x: 1, y: 1, ...doc }),
    0,
  )
})

test('fishProductivityForCell prefers ocean over lake and river', () => {
  const doc = waterDoc(3, 3, {
    ocean: [[0, 1]],
    lake: [[2, 1]],
    river: [[1, 0]],
  })
  assert.strictEqual(
    fishProductivityForCell({ x: 1, y: 1, ...doc }),
    FISH_PRODUCTIVITY_OCEAN,
  )
})

test('fishProductivityForCell uses lake when no ocean neighbor', () => {
  const doc = waterDoc(3, 3, { lake: [[1, 0]] })
  assert.strictEqual(
    fishProductivityForCell({ x: 1, y: 1, ...doc }),
    FISH_PRODUCTIVITY_LAKE,
  )
})

test('fishProductivityForCell uses river when no ocean or lake neighbor', () => {
  const doc = waterDoc(3, 3, { river: [[1, 2]] })
  assert.strictEqual(
    fishProductivityForCell({ x: 1, y: 1, ...doc }),
    FISH_PRODUCTIVITY_RIVER,
  )
})

test('sumFishProductionOnCells sums productivity on claimed cells only', () => {
  const doc = waterDoc(3, 3, { ocean: [[0, 0], [2, 0]] })
  const sum = sumFishProductionOnCells({
    claimedCells: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    ...doc,
  })
  // (1,0) touches ocean at (0,0) and (2,0); (1,1) does not.
  assert.strictEqual(sum, FISH_PRODUCTIVITY_OCEAN)
})

test('hinterlandFoodWeight uses fish floor when arable is missing', () => {
  assert.strictEqual(hinterlandFoodWeight(0, FISH_PRODUCTIVITY_OCEAN), FISH_COLLAPSE_WEIGHT)
  assert.strictEqual(hinterlandFoodWeight(0.5, FISH_PRODUCTIVITY_OCEAN), 0.5)
  assert.strictEqual(hinterlandFoodWeight(0, 0), 0)
})
