import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTemperature } from './generateTemperature.js'
import { generateRainfall } from './generateRainfall.js'
import { refreshFieldsAfterErosion } from './refreshFieldsAfterErosion.js'

test('refreshFieldsAfterErosion recomputes all fields from eroded elevation', () => {
  const width = 8
  const height = 8
  const elevation = new Float32Array(width * height).fill(0.55)
  const drainage = new Float32Array(width * height).fill(0.5)

  const fields = refreshFieldsAfterErosion({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    elevation,
    drainage,
    width,
    height,
  })

  assert.strictEqual(fields.elevation, elevation)
  assert.strictEqual(fields.drainage, drainage)
  assert.strictEqual(fields.temperature.length, width * height)
  assert.strictEqual(fields.rainfall.length, width * height)
  assert.strictEqual(fields.salidity.length, width * height)
})

test('refreshFieldsAfterErosion uses prevailing wind for rainfall', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.6)
  elevation[4 * width + 4] = 0.85
  const drainage = new Float32Array(width * height)

  const wind0 = refreshFieldsAfterErosion({
    geographySeed: 7,
    prevailingWindDegrees: 0,
    elevation,
    drainage,
    width,
    height,
  })
  const wind180 = refreshFieldsAfterErosion({
    geographySeed: 7,
    prevailingWindDegrees: 180,
    elevation,
    drainage,
    width,
    height,
  })

  const directRain0 = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees: 0,
  })
  const directRain180 = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees: 180,
  })

  assert.deepStrictEqual(wind0.rainfall, directRain0)
  assert.deepStrictEqual(wind180.rainfall, directRain180)

  let differs = false
  for (let i = 0; i < wind0.rainfall.length; i += 1) {
    if (wind0.rainfall[i] !== wind180.rainfall[i]) {
      differs = true
      break
    }
  }
  assert.strictEqual(differs, true)
})

test('refreshFieldsAfterErosion temperature tracks elevation', () => {
  const width = 8
  const height = 8
  const low = new Float32Array(width * height).fill(0.5)
  const high = new Float32Array(width * height).fill(0.9)
  const drainage = new Float32Array(width * height)

  const lowFields = refreshFieldsAfterErosion({
    geographySeed: 1,
    prevailingWindDegrees: 45,
    elevation: low,
    drainage,
    width,
    height,
  })
  const highFields = refreshFieldsAfterErosion({
    geographySeed: 1,
    prevailingWindDegrees: 45,
    elevation: high,
    drainage,
    width,
    height,
  })

  const directLow = generateTemperature({ geographySeed: 1, width, height, elevation: low })
  assert.deepStrictEqual(lowFields.temperature, directLow)
  assert.ok(highFields.temperature[0] <= lowFields.temperature[0])
})
