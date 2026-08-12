import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBaselineInterimWorldDocument } from './buildBaselineInterimWorldDocument.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

test('buildBaselineInterimWorldDocument reuses climate cache across rainfall frames', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.55)
  elevation[0] = 0.1
  const first = buildBaselineInterimWorldDocument({
    geographySeed: 7,
    width,
    height,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
    options: DEFAULT_WORLD_GENERATION_OPTIONS,
    elevation,
    rainfall: new Float32Array(width * height),
  })
  const wetter = new Float32Array(width * height).fill(0.8)
  const second = buildBaselineInterimWorldDocument({
    geographySeed: 7,
    width,
    height,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
    options: DEFAULT_WORLD_GENERATION_OPTIONS,
    elevation,
    rainfall: wetter,
    climateCache: first.climateCache,
  })

  assert.strictEqual(second.climateCache.temperature, first.climateCache.temperature)
  assert.strictEqual(second.worldDocument.fields.elevation, elevation)
  assert.strictEqual(second.worldDocument.fields.rainfall, wetter)
  assert.ok(second.worldDocument.displayBiomes.length === width * height)
})
