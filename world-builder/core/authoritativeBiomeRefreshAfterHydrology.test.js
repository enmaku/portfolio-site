import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialPipelineState,
  runFullDerivedGeographyPipeline,
  runPipelineStep,
} from './derivedGeographyPipeline.js'
import { pickLandmassStageInput } from './landmassPipelineStageContracts.js'
import { LANDMASS_PIPELINE_STAGE_CONTRACTS } from './landmassPipelineStageContracts.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

const nonSeasonalOptions = resolveWorldGenerationOptions({ enableSeasonalHydrology: false })

function rasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + Math.round(arr[i] * 1e6) * (i + 1)) % 2147483647
  }
  return checksum
}

function byteRasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + arr[i] * (i + 1)) % 2147483647
  }
  return checksum
}

const NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS = {
  geographySeed: 12345,
  elevation: 1311863460,
  drainage: 1619507853,
  temperature: 59884643,
  rainfall: 1550911317,
  salinity: 401265340,
  biomes: 47747,
}

/**
 * @param {import('./types.js').ScalarFields} fields
 */
function climateScalarRefs(fields) {
  return {
    temperature: fields.temperature,
    rainfall: fields.rainfall,
    salinity: fields.salinity,
  }
}

test('fieldRefresh contract documents seasonal-only responsibility', () => {
  const contract = LANDMASS_PIPELINE_STAGE_CONTRACTS.fieldRefresh
  assert.strictEqual(contract.label, 'Seasonal climate annualization')
  assert.ok(contract.inputKeys.includes('biomes'))
  assert.ok(!contract.inputKeys.includes('workingElevation'))
})

test('fieldRefresh pass-through preserves hydrology exit climate scalars and biomes', () => {
  let state = createInitialPipelineState({
    ...params,
    options: nonSeasonalOptions,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const climateBefore = climateScalarRefs(state.fields)
  const biomesBefore = state.biomes

  state = runPipelineStep(state, 'fieldRefresh')

  assert.strictEqual(state.fields.temperature, climateBefore.temperature)
  assert.strictEqual(state.fields.rainfall, climateBefore.rainfall)
  assert.strictEqual(state.fields.salinity, climateBefore.salinity)
  assert.strictEqual(state.biomes, biomesBefore)
})

test('non-seasonal full pipeline final climate fields and biomes match hydrology exit', () => {
  let state = createInitialPipelineState({
    ...params,
    options: nonSeasonalOptions,
  })
  for (const stepId of ['physicalTerrainBaseline', 'erosion', 'hydrology']) {
    state = runPipelineStep(state, stepId)
  }

  const hydrologyClimate = {
    temperature: Float32Array.from(state.fields.temperature),
    rainfall: Float32Array.from(state.fields.rainfall),
    salinity: Float32Array.from(state.fields.salinity),
  }
  const hydrologyBiomes = Uint8Array.from(state.biomes)

  for (const stepId of ['fieldRefresh', 'coastAndResources', 'validation']) {
    state = runPipelineStep(state, stepId)
  }

  assert.deepStrictEqual(state.fields.temperature, hydrologyClimate.temperature)
  assert.deepStrictEqual(state.fields.rainfall, hydrologyClimate.rainfall)
  assert.deepStrictEqual(state.fields.salinity, hydrologyClimate.salinity)
  assert.deepStrictEqual(state.biomes, hydrologyBiomes)
})

test('non-seasonal full pipeline seed 12345 preserves golden climate and biome checksums', () => {
  const doc = runFullDerivedGeographyPipeline({
    ...params,
    options: nonSeasonalOptions,
  })

  assert.strictEqual(doc.geographySeed, NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.geographySeed)
  assert.strictEqual(
    rasterChecksum(doc.fields.elevation),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.elevation,
    'elevation checksum drift for non-seasonal pipeline seed 12345',
  )
  assert.strictEqual(
    rasterChecksum(doc.fields.drainage),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.drainage,
    'drainage checksum drift for non-seasonal pipeline seed 12345',
  )
  assert.strictEqual(
    rasterChecksum(doc.fields.temperature),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.temperature,
    'temperature checksum drift for non-seasonal pipeline seed 12345',
  )
  assert.strictEqual(
    rasterChecksum(doc.fields.rainfall),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.rainfall,
    'rainfall checksum drift for non-seasonal pipeline seed 12345',
  )
  assert.strictEqual(
    rasterChecksum(doc.fields.salinity),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.salinity,
    'salinity checksum drift for non-seasonal pipeline seed 12345',
  )
  assert.strictEqual(
    byteRasterChecksum(doc.biomes),
    NON_SEASONAL_PIPELINE_GOLDEN_CHECKSUMS.biomes,
    'biomes checksum drift for non-seasonal pipeline seed 12345',
  )
})

test('field refresh stage input carries hydrology biomes for pass-through', () => {
  let state = createInitialPipelineState({
    ...params,
    options: nonSeasonalOptions,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const fieldRefreshInput = pickLandmassStageInput('fieldRefresh', state)
  assert.strictEqual(fieldRefreshInput.biomes, state.biomes)
})
