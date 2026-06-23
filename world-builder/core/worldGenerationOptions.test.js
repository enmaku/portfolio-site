import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_BREACH_THRESHOLD,
  DEFAULT_WORLD_GENERATION_OPTIONS,
  resolveWorldGenerationOptions,
} from './worldGenerationOptions.js'

test('DEFAULT_WORLD_GENERATION_OPTIONS documents breachThreshold default', () => {
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.breachThreshold, 0.3)
  assert.strictEqual(DEFAULT_BREACH_THRESHOLD, 0.3)
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.maxValidationRetries, 3)
})

test('resolveWorldGenerationOptions preserves breachThreshold default', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.breachThreshold, DEFAULT_BREACH_THRESHOLD)
})

test('resolveWorldGenerationOptions merges partial breachThreshold override', () => {
  const options = resolveWorldGenerationOptions({ breachThreshold: 0.75 })
  assert.strictEqual(options.breachThreshold, 0.75)
  assert.strictEqual(options.seaLevel, DEFAULT_WORLD_GENERATION_OPTIONS.seaLevel)
})

test('resolveWorldGenerationOptions preserves stream-power incision defaults', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.inciseIterations, 5)
  assert.strictEqual(options.streamPowerK, 0.0025)
  assert.strictEqual(options.streamPowerM, 0.45)
  assert.strictEqual(options.streamPowerN, 1.1)
  assert.strictEqual(options.channelInitiationThreshold, 0.018)
})

test('resolveWorldGenerationOptions preserves hydrology validation defaults', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.enforceNavigableRiverQuota, false)
  assert.strictEqual(options.enforceCoastMouth, false)
  assert.strictEqual(options.maxParallelStrandRatio, 0.35)
  assert.strictEqual(options.minCoastConnectedNavigablePathCells, 8)
})

test('resolveWorldGenerationOptions preserves maxValidationRetries default', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.maxValidationRetries, 3)
})

test('resolveWorldGenerationOptions enables river bridging and meander refine by default', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.riverAttractionRadiusScale, 1)
  assert.strictEqual(options.enableMeanderRefine, true)
})

test('resolveWorldGenerationOptions merges enableMeanderRefine override', () => {
  const options = resolveWorldGenerationOptions({ enableMeanderRefine: false })
  assert.strictEqual(options.enableMeanderRefine, false)
  assert.strictEqual(options.riverAttractionRadiusScale, 1)
})

test('resolveWorldGenerationOptions preserves rainfall amount default', () => {
  const options = resolveWorldGenerationOptions()
  assert.strictEqual(options.rainfallAmountScale, 1)
})

test('resolveWorldGenerationOptions merges rainfallAmountScale override', () => {
  const options = resolveWorldGenerationOptions({ rainfallAmountScale: 1.75 })
  assert.strictEqual(options.rainfallAmountScale, 1.75)
  assert.strictEqual(options.rainfallFrequencyScale, 1)
})
