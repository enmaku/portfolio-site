import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import {
  SEASON_ORDER,
  accumulateEffectiveRunoff,
  computeSeasonalRunoff,
  computeSeasonalSnowAccum,
  deriveAnnualMeanClimate,
  deriveYearlyClimateNoise,
  seasonRainfallMultiplier,
} from './seasonalClimatology.js'

test('SEASON_ORDER cycles through four seasons', () => {
  assert.deepEqual(SEASON_ORDER, ['dry', 'wet', 'cold', 'melt'])
})

test('deriveYearlyClimateNoise is reproducible and varies by year', () => {
  const a = deriveYearlyClimateNoise(42, 0, 0.3)
  const b = deriveYearlyClimateNoise(42, 0, 0.3)
  const c = deriveYearlyClimateNoise(42, 1, 0.3)
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('seasonRainfallMultiplier scales wet season by year multiplier', () => {
  const options = { ...DEFAULT_WORLD_GENERATION_OPTIONS }
  assert.ok(seasonRainfallMultiplier('wet', options, 1.2) > seasonRainfallMultiplier('dry', options, 1))
  assert.ok(seasonRainfallMultiplier('cold', options, 1) < seasonRainfallMultiplier('dry', options, 1))
})

test('computeSeasonalRunoff wet exceeds dry on the same cell', () => {
  const rainfall = new Float32Array([0.6])
  const options = { ...DEFAULT_WORLD_GENERATION_OPTIONS }
  const dry = computeSeasonalRunoff({
    baseRainfall: rainfall,
    season: 'dry',
    options,
    yearMult: 1,
  })
  const wet = computeSeasonalRunoff({
    baseRainfall: rainfall,
    season: 'wet',
    options,
    yearMult: 1,
  })
  assert.ok(wet[0] > dry[0])
})

test('deriveAnnualMeanClimate returns copies of base fields when influence scale is zero', () => {
  const baseRainfall = new Float32Array([0.6])
  const baseTemperature = new Float32Array([0.5])
  const { rainfall, temperature } = deriveAnnualMeanClimate({
    baseRainfall,
    baseTemperature,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, seasonalBiomeInfluenceScale: 0 },
  })
  assert.notStrictEqual(rainfall, baseRainfall)
  assert.notStrictEqual(temperature, baseTemperature)
  assert.equal(rainfall[0], baseRainfall[0])
  assert.equal(temperature[0], baseTemperature[0])
})

test('deriveAnnualMeanClimate applies season weights at full influence scale', () => {
  const baseRainfall = new Float32Array([0.5])
  const baseTemperature = new Float32Array([0.5])
  const { rainfall, temperature } = deriveAnnualMeanClimate({
    baseRainfall,
    baseTemperature,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, seasonalBiomeInfluenceScale: 1 },
  })
  assert.ok(rainfall[0] < baseRainfall[0])
  assert.ok(temperature[0] > 0 && temperature[0] <= 1)
})

test('computeSeasonalSnowAccum scales cap accumulation by the wind factor', () => {
  const baseRainfall = new Float32Array([0.5, 0.5])
  const snowCapMask = new Uint8Array([1, 1])
  const windAccumFactor = new Float32Array([1.4, 0.6])
  const options = { ...DEFAULT_WORLD_GENERATION_OPTIONS }

  const accum = computeSeasonalSnowAccum({
    baseRainfall,
    snowCapMask,
    windAccumFactor,
    options,
    yearMult: 1,
  })

  assert.ok(accum[0] > accum[1])
})

test('accumulateEffectiveRunoff tracks peak wet and melt runoff', () => {
  const effective = new Float32Array([0, 0])
  const wet = new Float32Array([5, 1])
  const dry = new Float32Array([9, 0])
  accumulateEffectiveRunoff(effective, wet, 'wet')
  accumulateEffectiveRunoff(effective, dry, 'dry')
  assert.equal(effective[0], 5)
  assert.equal(effective[1], 1)
})
