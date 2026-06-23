import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { refreshFieldsAfterErosion } from '../fields/refreshFieldsAfterErosion.js'
import { deriveAnnualMeanClimate } from './seasonalClimatology.js'
import {
  DEFAULT_WORLD_GENERATION_OPTIONS,
  resolveWorldGenerationOptions,
} from '../worldGenerationOptions.js'

const GRID = 64
const SEEDS = [42, 12345, 7777, 31415, 99999]
const STRESS_YEARS = 25

/** @param {Uint8Array} baseline @param {Uint8Array} candidate */
function biomeDriftRate(baseline, candidate) {
  let changed = 0
  for (let i = 0; i < baseline.length; i += 1) {
    if (baseline[i] !== candidate[i]) changed += 1
  }
  return changed / baseline.length
}

/**
 * @param {number} geographySeed
 * @param {Partial<import('../types.js').WorldGenerationOptions>} optionOverrides
 */
function runThroughHydrology(geographySeed, optionOverrides) {
  let state = createInitialPipelineState({
    geographySeed,
    prevailingWindDegrees: 90,
    width: GRID,
    height: GRID,
    options: resolveWorldGenerationOptions(optionOverrides),
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')
  return state
}

/**
 * Land-biome drift from annual-mean climate adjustment alone (same hydrology geometry).
 * @param {Partial<import('../types.js').WorldGenerationOptions>} optionOverrides
 */
function meanAnnualClimateBiomeDrift(optionOverrides) {
  const options = resolveWorldGenerationOptions(optionOverrides)
  const drifts = []

  for (const seed of SEEDS) {
    const state = runThroughHydrology(seed, optionOverrides)
    const { width, height } = state
    const drainage = state.fields?.drainage
    if (!state.workingElevation || !drainage || !state.lakeMask || !state.riverNetworkMask) {
      continue
    }

    const refreshed = refreshFieldsAfterErosion({
      geographySeed: state.geographySeed,
      prevailingWindDegrees: state.prevailingWindDegrees,
      elevation: state.workingElevation,
      drainage,
      width,
      height,
      options,
    })

    const hydrology = {
      lakeMask: state.lakeMask,
      riverCorridorMask: state.riverCorridorMask ?? state.riverNetworkMask,
      flowDirection: state.flowDirection,
    }

    const withoutAnnual = classifyBiomesWithHydrology(
      refreshed,
      width,
      height,
      hydrology,
      options.seaLevel,
    )

    const annualClimate = deriveAnnualMeanClimate({
      baseRainfall: refreshed.rainfall,
      baseTemperature: refreshed.temperature,
    })
    const withAnnual = classifyBiomesWithHydrology(
      { ...refreshed, ...annualClimate },
      width,
      height,
      hydrology,
      options.seaLevel,
    )

    drifts.push(biomeDriftRate(withoutAnnual, withAnnual))
  }

  return drifts.reduce((sum, rate) => sum + rate, 0) / drifts.length
}

test('deriveAnnualMeanClimate causes no biome drift at 25 simulation years with extreme season multipliers', () => {
  const drift = meanAnnualClimateBiomeDrift({
    seasonalYearCount: STRESS_YEARS,
    dryRainMult: 0,
    wetRainMult: 3,
    yearlyClimateNoiseScale: 0.6,
    lakeEvaporationScale: 2.5,
    snowAccumRate: 2.5,
    meltReleaseScale: 2.5,
    lakeBankCrumblePerYear: 5,
  })
  assert.equal(drift, 0, `annual-mean climate drift should be 0, got ${(drift * 100).toFixed(2)}%`)
})

test('deriveAnnualMeanClimate causes no biome drift at default options regardless of year count', () => {
  for (const seasonalYearCount of [1, 5, STRESS_YEARS]) {
    const drift = meanAnnualClimateBiomeDrift({
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      seasonalYearCount,
    })
    assert.equal(
      drift,
      0,
      `annual-mean climate drift should be 0 at ${seasonalYearCount} years, got ${(drift * 100).toFixed(2)}%`,
    )
  }
})
