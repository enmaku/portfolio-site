import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  assertLandmassStageOutputs,
  buildPipelineStateForHydrologySubsteps,
  deriveLandmassStageContract,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'
import {
  LANDMASS_PIPELINE_STAGE_MODULES,
  LANDMASS_PIPELINE_STAGE_MODULE_BY_ID,
  selectLandmassStageInput,
} from './landmassPipelineStageModules.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from './derivedGeographyPipeline.js'
import { LandmassPipelineCancelledError } from './landmassPipelineTypes.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 32,
  height: 32,
}

const contractsSource = readFileSync(
  fileURLToPath(new URL('./landmassPipelineStageContracts.js', import.meta.url)),
  'utf8',
)

test('stage contracts are derived from stage modules as a single source of truth', () => {
  for (const module of LANDMASS_PIPELINE_STAGE_MODULES) {
    const contract = LANDMASS_PIPELINE_STAGE_CONTRACTS[module.id]
    assert.ok(contract, `missing contract for ${module.id}`)
    assert.strictEqual(contract.id, module.id)
    assert.strictEqual(contract.label, module.label)
    assert.deepStrictEqual(contract.inputKeys, Object.keys(module.inputs))
    assert.deepStrictEqual(contract.outputKeys, [...module.outputKeys])
    assert.deepStrictEqual(deriveLandmassStageContract(module), contract)
    assert.ok(
      contract.outputKeys.includes('lastCompletedStep'),
      `${module.id} must declare lastCompletedStep output`,
    )
  }
})

test('landmass contract source omits hand-maintained stage picker switch', () => {
  assert.ok(!contractsSource.includes('pickErosionStageInput'))
  assert.ok(!contractsSource.includes('pickHydrologyStageInput'))
  assert.ok(!contractsSource.includes('pickFieldRefreshStageInput'))
  assert.ok(!contractsSource.includes('pickCoastAndResourcesStageInput'))
  assert.ok(!contractsSource.includes('pickValidationStageInput'))
  assert.ok(!contractsSource.includes('pickPhysicalTerrainBaselineInput'))
  assert.ok(!contractsSource.includes('switch (stepId)'))
})

test('selectLandmassStageInput rejects erosion without physical terrain baseline', () => {
  const state = createInitialPipelineState(params)
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.erosion
  assert.throws(
    () => selectLandmassStageInput(module, state),
    /physicalTerrainBaseline/,
  )
})

test('selectLandmassStageInput rejects hydrology without erosion', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.hydrology
  assert.throws(
    () => selectLandmassStageInput(module, state),
    /erosion/,
  )
})

test('selectLandmassStageInput rejects field refresh without hydrology outputs', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.fieldRefresh
  assert.throws(
    () => selectLandmassStageInput(module, state),
    /hydrology/,
  )
})

test('selectLandmassStageInput rejects coast and resources before field refresh', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.coastAndResources
  assert.throws(
    () => selectLandmassStageInput(module, state),
    /fieldRefresh/,
  )
})

test('selectLandmassStageInput rejects validation before coast and resources', () => {
  let state = createInitialPipelineState(params)
  for (const stepId of [
    'physicalTerrainBaseline',
    'erosion',
    'hydrology',
    'fieldRefresh',
  ]) {
    state = runPipelineStep(state, stepId)
  }
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.validation
  assert.throws(
    () => selectLandmassStageInput(module, state),
    /coastAndResources/,
  )
})

test('selectLandmassStageInput yields exactly the contract input keys', () => {
  let state = createInitialPipelineState(params)
  for (const module of LANDMASS_PIPELINE_STAGE_MODULES) {
    const input = selectLandmassStageInput(module, state)
    assert.deepStrictEqual(
      Object.keys(input).sort(),
      [...LANDMASS_PIPELINE_STAGE_CONTRACTS[module.id].inputKeys].sort(),
    )
    state = runPipelineStep(state, module.id)
  }
})

test('pickLandmassStageInput delegates to module input selectors', () => {
  let state = createInitialPipelineState(params)
  for (const module of LANDMASS_PIPELINE_STAGE_MODULES) {
    const picked = pickLandmassStageInput(module.id, state)
    const selected = selectLandmassStageInput(module, state)
    assert.deepStrictEqual(picked, selected)
    state = runPipelineStep(state, module.id)
  }
})

test('assertLandmassStageOutputs rejects missing erosion output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('erosion', { lastCompletedStep: 'erosion' }),
    /erosion missing output erodedElevation/,
  )
})

test('assertLandmassStageOutputs rejects missing hydrology output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('hydrology', { lastCompletedStep: 'hydrology' }),
    /hydrology missing output lakeMask/,
  )
})

test('assertLandmassStageOutputs rejects missing validation output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('validation', { lastCompletedStep: 'validation' }),
    /validation missing output generationReport/,
  )
})

test('assertLandmassStageOutputs rejects missing physical terrain baseline output at seam', () => {
  assert.throws(
    () =>
      assertLandmassStageOutputs('physicalTerrainBaseline', {
        lastCompletedStep: 'physicalTerrainBaseline',
      }),
    /physicalTerrainBaseline missing output baselineDoc/,
  )
})

test('assertLandmassStageOutputs rejects missing coast and resources output at seam', () => {
  assert.throws(
    () =>
      assertLandmassStageOutputs('coastAndResources', { lastCompletedStep: 'coastAndResources' }),
    /coastAndResources missing output coastNavigability/,
  )
})

test('buildPipelineStateForHydrologySubsteps seeds minimal erosion-complete state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = {
    ...state,
    coastalNodes: [{ cellIndex: 0, navigability: 1 }],
    metalsRaster: new Float32Array(4),
  }

  const input = selectLandmassStageInput(
    LANDMASS_PIPELINE_STAGE_MODULE_BY_ID.hydrology,
    state,
  )
  const hydrologyState = buildPipelineStateForHydrologySubsteps(input)

  assert.strictEqual(hydrologyState.coastalNodes, null)
  assert.strictEqual(hydrologyState.metalsRaster, null)
  assert.strictEqual(hydrologyState.generationReport, null)
  assert.strictEqual(hydrologyState.lastCompletedStep, 'erosion')
  assert.ok(hydrologyState.erodedElevation)
  assert.ok(hydrologyState.baselineDoc)
})

test('runPipelineStep asserts contracted outputs after erosion, hydrology, and validation', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  assert.ok(state.erodedElevation)
  state = runPipelineStep(state, 'hydrology')
  assert.ok(state.lakeMask)
  for (const stepId of ['fieldRefresh', 'coastAndResources']) {
    state = runPipelineStep(state, stepId)
  }
  state = runPipelineStep(state, 'validation')
  assert.ok(state.generationReport)
})

test('runPipelineStep hydrology cancellation throws LandmassPipelineCancelledError', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  let completedSubsteps = 0
  assert.throws(
    () => {
      runPipelineStep(state, 'hydrology', {
        onSubstepComplete() {
          completedSubsteps += 1
        },
        shouldCancel() {
          return completedSubsteps >= 2
        },
      })
    },
    (error) => error instanceof LandmassPipelineCancelledError,
  )
})
