import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveSalinityFromOcean } from './fields/deriveSalinityFromOcean.js'
import { generateRainfall } from './fields/generateRainfall.js'
import { generateTemperature } from './fields/generateTemperature.js'
import { refreshClimateScalarsAfterElevationMutation } from './fields/refreshClimateScalarsAfterElevationMutation.js'
import {
  buildWorldDocumentFromPipelineState,
  createInitialPipelineState,
  runFullDerivedGeographyPipeline,
  runPipelineStep,
} from './derivedGeographyPipeline.js'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import { pickLandmassStageInput } from './landmassPipelineStageContracts.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 */
function expectedSalinityForElevation(elevation, width, height, seaLevel) {
  return deriveSalinityFromOcean({ elevation, width, height, seaLevel })
}

test('refreshClimateScalarsAfterElevationMutation temperature and rainfall track mutated elevation', () => {
  const width = 8
  const height = 8
  const low = new Float32Array(width * height).fill(0.5)
  const high = new Float32Array(width * height).fill(0.9)
  const drainage = new Float32Array(width * height)

  const fields = refreshClimateScalarsAfterElevationMutation({
    geographySeed: 1,
    prevailingWindDegrees: 45,
    elevation: high,
    drainage,
    width,
    height,
  })

  const expectedTemperature = generateTemperature({
    geographySeed: 1,
    width,
    height,
    elevation: high,
  })
  const expectedRainfall = generateRainfall({
    geographySeed: 1,
    width,
    height,
    elevation: high,
    prevailingWindDegrees: 45,
  })

  assert.deepStrictEqual(fields.temperature, expectedTemperature)
  assert.deepStrictEqual(fields.rainfall, expectedRainfall)
  assert.ok(fields.temperature[0] <= generateTemperature({
    geographySeed: 1,
    width,
    height,
    elevation: low,
  })[0])
})

test('refreshClimateScalarsAfterElevationMutation salinity tracks synthetic elevation breach', () => {
  const width = 12
  const height = 12
  const seaLevel = 0.4
  const elevation = new Float32Array(width * height).fill(0.55)
  elevation[5 * width + 5] = 0.35
  const drainage = new Float32Array(width * height).fill(0.5)
  const staleSalinity = new Float32Array(width * height).fill(0.05)

  const fields = refreshClimateScalarsAfterElevationMutation({
    geographySeed: 1,
    prevailingWindDegrees: 90,
    elevation,
    drainage,
    width,
    height,
    options: { seaLevel },
  })

  const expected = expectedSalinityForElevation(elevation, width, height, seaLevel)
  assert.deepStrictEqual(fields.salinity, expected)
  assert.notDeepStrictEqual(fields.salinity, staleSalinity)
  assert.ok(fields.salinity[5 * width + 5] >= 0.99)
  assert.ok(fields.salinity[5 * width + 6] < fields.salinity[5 * width + 5])
})

test('runPipelineStep erosion preview climate scalars match refresh hook with prevailing wind', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const expected = refreshClimateScalarsAfterElevationMutation({
    geographySeed: params.geographySeed,
    prevailingWindDegrees: params.prevailingWindDegrees,
    elevation: state.erodedElevation,
    drainage: state.baselineDoc.fields.drainage,
    width: params.width,
    height: params.height,
    options: state.options,
  })

  assert.deepStrictEqual(state.fields.salinity, expected.salinity)
  assert.deepStrictEqual(state.fields.temperature, expected.temperature)
  assert.deepStrictEqual(state.fields.rainfall, expected.rainfall)
})

test('runPipelineStep erosion preview salinity matches eroded elevation coast distance', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const expected = expectedSalinityForElevation(
    state.erodedElevation,
    state.width,
    state.height,
    state.options.seaLevel,
  )
  assert.deepStrictEqual(state.fields.salinity, expected)
})

test('runPipelineStep erosion preview salinity is not frozen pre-erosion raster', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  const baselineSalinity = Float32Array.from(state.baselineDoc.fields.salinity)
  state = runPipelineStep(state, 'erosion')

  let elevationMutated = false
  for (let i = 0; i < state.erodedElevation.length; i += 1) {
    if (state.erodedElevation[i] !== state.baselineDoc.fields.elevation[i]) {
      elevationMutated = true
      break
    }
  }
  assert.ok(elevationMutated)

  let salinityDiffersFromBaseline = false
  for (let i = 0; i < state.fields.salinity.length; i += 1) {
    if (state.fields.salinity[i] !== baselineSalinity[i]) {
      salinityDiffersFromBaseline = true
      break
    }
  }
  assert.ok(salinityDiffersFromBaseline)
})

test('runPipelineStep hydrology preview salinity is not frozen pre-erosion raster', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const erosionSalinity = Float32Array.from(state.fields.salinity)
  state = runPipelineStep(state, 'hydrology')

  let elevationMutated = false
  for (let i = 0; i < state.workingElevation.length; i += 1) {
    if (state.workingElevation[i] !== state.erodedElevation[i]) {
      elevationMutated = true
      break
    }
  }
  if (elevationMutated) {
    let salinityDiffersFromErosion = false
    for (let i = 0; i < state.fields.salinity.length; i += 1) {
      if (state.fields.salinity[i] !== erosionSalinity[i]) {
        salinityDiffersFromErosion = true
        break
      }
    }
    assert.ok(salinityDiffersFromErosion)
  }

  const expected = expectedSalinityForElevation(
    state.workingElevation,
    state.width,
    state.height,
    state.options.seaLevel,
  )
  assert.deepStrictEqual(state.fields.salinity, expected)
})

test('runPipelineStep hydrology preview salinity matches settled elevation coast distance', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const expected = expectedSalinityForElevation(
    state.workingElevation,
    state.width,
    state.height,
    state.options.seaLevel,
  )
  assert.deepStrictEqual(state.fields.salinity, expected)
})

test('buildWorldDocumentFromPipelineState erosion and hydrology previews carry fresh salinity', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const erosionDoc = buildWorldDocumentFromPipelineState(state)
  assert.deepStrictEqual(
    erosionDoc.fields.salinity,
    expectedSalinityForElevation(
      state.erodedElevation,
      state.width,
      state.height,
      state.options.seaLevel,
    ),
  )

  state = runPipelineStep(state, 'hydrology')
  const hydrologyDoc = buildWorldDocumentFromPipelineState(state)
  assert.deepStrictEqual(
    hydrologyDoc.fields.salinity,
    expectedSalinityForElevation(
      state.workingElevation,
      state.width,
      state.height,
      state.options.seaLevel,
    ),
  )
})

test('field refresh stage input salinity from hydrology is fresh for working elevation', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const fieldRefreshInput = pickLandmassStageInput('fieldRefresh', state)
  const expected = expectedSalinityForElevation(
    fieldRefreshInput.workingElevation,
    state.width,
    state.height,
    state.options.seaLevel,
  )
  assert.deepStrictEqual(fieldRefreshInput.fields.salinity, expected)
})

test('full pipeline salinity unchanged after elevation-mutation refresh hooks', () => {
  const fromPipeline = runFullDerivedGeographyPipeline(params)
  const direct = generateDerivedGeography(params)
  assert.deepStrictEqual(fromPipeline.fields.salinity, direct.fields.salinity)
})
