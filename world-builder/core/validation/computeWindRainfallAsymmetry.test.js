import assert from 'node:assert/strict'
import test from 'node:test'
import { computeWindRainfallAsymmetry } from './computeWindRainfallAsymmetry.js'

function makeHighlandBand() {
  const width = 10
  const height = 6
  const elevation = new Float32Array(width * height)
  const rainfall = new Float32Array(width * height)
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 2; x <= 7; x += 1) {
      const idx = y * width + x
      elevation[idx] = 0.8
      // West (low x) is wetter than east (high x).
      rainfall[idx] = 0.8 - (x - 2) * 0.1
    }
  }
  return { width, height, elevation, rainfall }
}

test('computeWindRainfallAsymmetry reports a positive gap when the windward flank is wetter', () => {
  const { width, height, elevation, rainfall } = makeHighlandBand()

  const westWind = computeWindRainfallAsymmetry({
    rainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
  })

  assert.ok(westWind.highlandCellCount > 0)
  assert.ok(westWind.signedAsymmetry > 0)
  assert.ok(westWind.asymmetry > 0)
})

test('computeWindRainfallAsymmetry flips sign when the wind reverses', () => {
  const { width, height, elevation, rainfall } = makeHighlandBand()

  const westWind = computeWindRainfallAsymmetry({
    rainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
  })
  const eastWind = computeWindRainfallAsymmetry({
    rainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees: 90,
  })

  assert.ok(westWind.signedAsymmetry > 0)
  assert.ok(eastWind.signedAsymmetry < 0)
})

test('computeWindRainfallAsymmetry returns zero when no highland cells exist', () => {
  const width = 4
  const height = 4
  const result = computeWindRainfallAsymmetry({
    rainfall: new Float32Array(width * height).fill(0.5),
    elevation: new Float32Array(width * height).fill(0.3),
    width,
    height,
    prevailingWindDegrees: 90,
  })

  assert.equal(result.highlandCellCount, 0)
  assert.equal(result.asymmetry, 0)
})
