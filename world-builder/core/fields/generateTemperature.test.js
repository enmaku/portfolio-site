import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'
import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import { generateTemperature } from './generateTemperature.js'

const REPRESENTATIVE_GEOGRAPHY_SEEDS = [12345, 31842, DEFAULT_GEOGRAPHY_SEED]

/** Pre-#316 temperature for multi-row grids (degenerate 1-row/1-col grids divide by zero). */
function legacyMultiRowGenerateTemperature({ geographySeed, width, height, elevation, options }) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'temperature')
  const noise = generateFbm2d({
    width,
    height,
    seed,
    octaves: 4,
    frequency: scaleForGridSize(0.015, width),
    persistence: 0.45,
  })
  const out = new Float32Array(width * height)
  const equatorRow = (height - 1) / 2

  function clamp01(value) {
    if (value < 0) return 0
    if (value > 1) return 1
    return value
  }

  for (let y = 0; y < height; y += 1) {
    const latitudeFactor = 1 - Math.abs(y - equatorRow) / equatorRow
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const lapse = elevation[idx] * resolved.temperatureLapseRate
      const base = latitudeFactor * 0.65 + noise[idx] * 0.35
      out[idx] = clamp01(base - lapse)
    }
  }

  return out
}

function rasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + Math.round(arr[i] * 1e6) * (i + 1)) % 2147483647
  }
  return checksum
}

const TEMPERATURE_GOLDEN_CHECKSUMS = new Map([
  [12345, 1559545708],
  [31842, 582217037],
  [DEFAULT_GEOGRAPHY_SEED, 1813413154],
])

test('generateTemperature returns finite values for a 1-row grid', () => {
  const width = 8
  const height = 1
  const elevation = new Float32Array(width).fill(0.5)

  const temperature = generateTemperature({
    geographySeed: 42,
    width,
    height,
    elevation,
  })

  assert.strictEqual(temperature.length, width)
  for (let idx = 0; idx < temperature.length; idx += 1) {
    assert.ok(Number.isFinite(temperature[idx]), `temperature[${idx}] is not finite`)
    assert.ok(temperature[idx] >= 0 && temperature[idx] <= 1)
  }
})

test('generateTemperature returns finite values for a 1-column grid', () => {
  const width = 1
  const height = 8
  const elevation = new Float32Array(height).fill(0.5)

  const temperature = generateTemperature({
    geographySeed: 7,
    width,
    height,
    elevation,
  })

  assert.strictEqual(temperature.length, height)
  for (const value of temperature) {
    assert.ok(Number.isFinite(value))
  }
})

test('generateTemperature cools poleward rows relative to the equator band', () => {
  const width = 9
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.45)

  const temperature = generateTemperature({
    geographySeed: 101,
    width,
    height,
    elevation,
  })

  const northPole = temperature[0 * width + 4]
  const equator = temperature[4 * width + 4]
  const southPole = temperature[8 * width + 4]

  assert.ok(northPole < equator)
  assert.ok(southPole < equator)
})

test('generateTemperature applies elevation lapse cooling', () => {
  const width = 3
  const height = 1
  const lowland = new Float32Array([0.4, 0.4, 0.4])
  const highland = new Float32Array([0.4, 0.95, 0.4])
  const params = {
    geographySeed: 55,
    width,
    height,
    options: { temperatureLapseRate: 0.5 },
  }

  const low = generateTemperature({ ...params, elevation: lowland })
  const high = generateTemperature({ ...params, elevation: highland })

  assert.ok(high[1] < low[1])
})

test('generateTemperature is deterministic for the same geography seed', () => {
  const width = 12
  const height = 10
  const elevation = new Float32Array(width * height).fill(0.45)
  const params = {
    geographySeed: 31842,
    width,
    height,
    elevation,
  }

  const first = generateTemperature(params)
  const second = generateTemperature(params)
  assert.deepStrictEqual(Array.from(first), Array.from(second))
})

test('generateTemperature matches pre-#316 output on multi-row representative seeds', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const params = {
      geographySeed,
      width,
      height,
      elevation: doc.fields.elevation,
    }
    const current = generateTemperature(params)
    const legacy = legacyMultiRowGenerateTemperature(params)
    assert.deepStrictEqual(Array.from(current), Array.from(legacy))
  }
})

test('generateTemperature 1-row and 1-col grids are intentionally fixed (#316 degenerate-grid guard)', () => {
  const oneRow = generateTemperature({
    geographySeed: 42,
    width: 8,
    height: 1,
    elevation: new Float32Array(8).fill(0.5),
  })
  const oneCol = generateTemperature({
    geographySeed: 7,
    width: 1,
    height: 8,
    elevation: new Float32Array(8).fill(0.5),
  })

  for (const value of oneRow) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
  for (const value of oneCol) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
})

test('generateTemperature preserves golden checksums for representative seeds', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const temperature = generateTemperature({
      geographySeed,
      width,
      height,
      elevation: doc.fields.elevation,
    })
    assert.strictEqual(
      rasterChecksum(temperature),
      TEMPERATURE_GOLDEN_CHECKSUMS.get(geographySeed),
      `temperature checksum drift for seed ${geographySeed}`,
    )
  }
})
