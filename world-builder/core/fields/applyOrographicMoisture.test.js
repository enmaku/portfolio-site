import assert from 'node:assert/strict'
import test from 'node:test'
import { applyOrographicMoisture } from './applyOrographicMoisture.js'

// Ramped mountain: ascending west flank, peak at x=4, descending east flank.
const PROFILE = [0.3, 0.4, 0.55, 0.75, 0.95, 0.6, 0.45, 0.4, 0.3]
const WIDTH = PROFILE.length
const HEIGHT = 5
const ROW = 2
const WINDWARD_COL = 3
const LEEWARD_COL = 5

function buildMountain() {
  const elevation = new Float32Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      elevation[y * WIDTH + x] = PROFILE[x]
    }
  }
  return elevation
}

test('applyOrographicMoisture enhances the windward flank and dries the leeward flank', () => {
  const elevation = buildMountain()
  const rainfall = new Float32Array(WIDTH * HEIGHT).fill(0.5)

  // Wind from the west (270): air climbs the west flank, dries on the east flank.
  const out = applyOrographicMoisture({
    rainfall,
    elevation,
    width: WIDTH,
    height: HEIGHT,
    prevailingWindDegrees: 270,
  })

  const windwardIdx = ROW * WIDTH + WINDWARD_COL
  const leewardIdx = ROW * WIDTH + LEEWARD_COL

  assert.ok(out[windwardIdx] > rainfall[windwardIdx])
  assert.ok(out[leewardIdx] < rainfall[leewardIdx])
})

test('applyOrographicMoisture with liftStrength 0 only dries leeward cells', () => {
  const elevation = buildMountain()
  const rainfall = new Float32Array(WIDTH * HEIGHT).fill(0.5)

  const out = applyOrographicMoisture({
    rainfall,
    elevation,
    width: WIDTH,
    height: HEIGHT,
    prevailingWindDegrees: 270,
    liftStrength: 0,
  })

  const windwardIdx = ROW * WIDTH + WINDWARD_COL
  const leewardIdx = ROW * WIDTH + LEEWARD_COL

  assert.ok(out[windwardIdx] <= rainfall[windwardIdx] + 1e-6)
  assert.ok(out[leewardIdx] < rainfall[leewardIdx])
})
