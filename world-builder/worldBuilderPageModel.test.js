import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'
import {
  buildDerivedGeographyParams,
  createControlsStateForSeed,
  createDefaultControlsState,
  createDefaultGenerationSettings,
  createGenerationStepStatuses,
  createHydrologyStatsForDisplay,
  createHydrologySubstepStatuses,
  createHydrologySubstepTimingsForDisplay,
  formatHydrologySubstepTimingForDisplay,
  DEFAULT_GEOGRAPHY_SEED,
  formatHydrologyMetricValue,
  formatSlopeAreaConcavityForDisplay,
  generationProgressValue,
  normalizeGeographySeed,
  validationStatusColor,
  validationStatusIcon,
} from './worldBuilderPageModel.js'

test('createDefaultControlsState matches default geography seed and generation options', () => {
  const defaults = createDefaultControlsState()
  assert.strictEqual(defaults.geographySeed, DEFAULT_GEOGRAPHY_SEED)
  assert.deepStrictEqual(defaults.generationOptions, DEFAULT_WORLD_GENERATION_OPTIONS)
})

test('buildDerivedGeographyParams forwards stream-power options to worker payload', () => {
  const options = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    inciseIterations: 8,
    streamPowerK: 0.004,
    streamPowerM: 0.5,
    streamPowerN: 1.2,
    channelInitiationThreshold: 0.02,
  }
  const params = buildDerivedGeographyParams(123, 270, options)

  assert.strictEqual(params.geographySeed, 123)
  assert.strictEqual(params.prevailingWindDegrees, 270)
  assert.strictEqual(params.options.inciseIterations, 8)
  assert.strictEqual(params.options.streamPowerK, 0.004)
  assert.strictEqual(params.options.streamPowerM, 0.5)
  assert.strictEqual(params.options.streamPowerN, 1.2)
  assert.strictEqual(params.options.channelInitiationThreshold, 0.02)
})

test('buildDerivedGeographyParams forwards enableMeanderRefine to worker payload', () => {
  const params = buildDerivedGeographyParams(123, 270, {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
  })
  assert.strictEqual(params.options.enableMeanderRefine, true)
})

test('createDefaultGenerationSettings resets sliders and seed-derived wind without changing seed', () => {
  const geographySeed = 424242
  const settings = createDefaultGenerationSettings(geographySeed)
  assert.deepStrictEqual(settings.generationOptions, DEFAULT_WORLD_GENERATION_OPTIONS)
  assert.strictEqual(
    settings.prevailingWindDegrees,
    createControlsStateForSeed(geographySeed).prevailingWindDegrees,
  )
})

test('normalizeGeographySeed converts signed 32-bit values to unsigned', () => {
  assert.strictEqual(normalizeGeographySeed(-1), 4294967295)
  assert.strictEqual(normalizeGeographySeed(12345), 12345)
})

test('generationProgressValue scales by completed steps', () => {
  assert.strictEqual(generationProgressValue(0, 6), 17)
  assert.strictEqual(generationProgressValue(5, 6), 100)
})

test('createHydrologySubstepStatuses marks active and completed substeps', () => {
  const substeps = [
    { id: 'hydrologyFill', label: 'Fill lakes' },
    { id: 'hydrologyClimate', label: 'Climate refresh' },
  ]
  const statuses = createHydrologySubstepStatuses(substeps, 1, 0)
  assert.deepStrictEqual(
    statuses.map((row) => row.status),
    ['complete', 'active'],
  )
})

test('createHydrologySubstepStatuses marks skipped substeps', () => {
  const substeps = [
    { id: 'hydrologyExtract', label: 'Extract river graph' },
    { id: 'hydrologyRefine', label: 'Meander refine' },
    { id: 'hydrologySettle', label: 'Settle drainage' },
  ]
  const statuses = createHydrologySubstepStatuses(substeps, 2, 1, new Set(['hydrologyRefine']))
  assert.deepStrictEqual(
    statuses.map((row) => row.status),
    ['complete', 'skipped', 'active'],
  )
})

test('formatHydrologySubstepTimingForDisplay shows skipped label', () => {
  assert.strictEqual(
    formatHydrologySubstepTimingForDisplay({
      substepId: 'hydrologyRefine',
      label: 'Meander refine',
      durationMs: 0,
      skipped: true,
    }),
    'Skipped',
  )
  assert.strictEqual(
    formatHydrologySubstepTimingForDisplay({
      substepId: 'hydrologyFill',
      label: 'Fill lakes',
      durationMs: 1.25,
    }),
    '1.3 ms',
  )
})

test('createHydrologySubstepTimingsForDisplay reads report timings', () => {
  const timings = createHydrologySubstepTimingsForDisplay({
    erosionStepCount: 1,
    navigableRiverEdgeCount: 2,
    coastalNodeCount: 3,
    validationRows: [],
    hydrologySubstepTimings: [
      { substepId: 'hydrologyFill', label: 'Fill lakes', durationMs: 1.5 },
    ],
  })
  assert.strictEqual(timings.length, 1)
  assert.strictEqual(timings[0].substepId, 'hydrologyFill')
})

test('createGenerationStepStatuses marks active and completed steps', () => {
  const steps = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]
  const statuses = createGenerationStepStatuses(steps, 1, 0)
  assert.deepStrictEqual(
    statuses.map((row) => row.status),
    ['complete', 'active', 'pending'],
  )
})

test('validationStatusColor and validationStatusIcon cover hard failures', () => {
  assert.strictEqual(validationStatusColor('fail'), 'negative')
  assert.strictEqual(validationStatusIcon('fail'), 'cancel')
})

test('createHydrologyStatsForDisplay surfaces hydrology metrics and rejection state', () => {
  const stats = createHydrologyStatsForDisplay({
    erosionStepCount: 1,
    navigableRiverEdgeCount: 2,
    coastalNodeCount: 3,
    validationRows: [],
    shouldReject: true,
    rejectionReasons: ['coastMouth: No river mouths detected'],
    hydrologySubstepTimings: [],
    hydrology: {
      breachCount: 1,
      endorheicCount: 2,
      endorheicFraction: 0.5,
      lakeCount: 4,
      riverCellCount: 10,
      navigableEdgeCount: 3,
      navigableKmEstimate: 12.5,
      mouthCount: 0,
      hacksLawExponent: 0.55,
      slopeAreaConcavitySamples: [0.1],
      parallelStrandRatio: 0.12,
      coastConnectedNavigablePathLength: 6,
    },
  })

  assert.strictEqual(stats.hacksLawExponent, 0.55)
  assert.strictEqual(stats.riverCellCount, 10)
  assert.strictEqual(stats.navigableEdgeCount, 3)
  assert.strictEqual(stats.slopeAreaConcavityMedian, 0.1)
  assert.strictEqual(stats.slopeAreaConcavitySampleCount, 1)
  assert.strictEqual(stats.lakeCount, 4)
  assert.strictEqual(stats.parallelStrandRatio, 0.12)
  assert.strictEqual(stats.navigableKmEstimate, 12.5)
  assert.strictEqual(stats.mouthCount, 0)
  assert.strictEqual(stats.breachCount, 1)
  assert.strictEqual(stats.endorheicFraction, 0.5)
  assert.strictEqual(stats.coastConnectedNavigablePathLength, 6)
  assert.strictEqual(stats.shouldReject, true)
  assert.deepStrictEqual(stats.rejectionReasons, ['coastMouth: No river mouths detected'])
})

test('createHydrologyStatsForDisplay defaults when hydrology section missing', () => {
  const stats = createHydrologyStatsForDisplay(undefined)
  assert.strictEqual(stats.riverCellCount, null)
  assert.strictEqual(stats.slopeAreaConcavitySampleCount, 0)
  assert.strictEqual(stats.shouldReject, false)
  assert.deepStrictEqual(stats.rejectionReasons, [])
})

test('formatSlopeAreaConcavityForDisplay renders median and sample count', () => {
  assert.strictEqual(formatSlopeAreaConcavityForDisplay(0.123, 4), '0.12 (4 samples)')
  assert.strictEqual(formatSlopeAreaConcavityForDisplay(null, 0), 'n/a')
})

test('formatHydrologyMetricValue renders null as n/a', () => {
  assert.strictEqual(formatHydrologyMetricValue(null), 'n/a')
  assert.strictEqual(formatHydrologyMetricValue(0.4567, 2), '0.46')
})
