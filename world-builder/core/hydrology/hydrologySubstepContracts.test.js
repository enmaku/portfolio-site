import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertHydrologySubstepOutputs,
  HYDROLOGY_SUBSTEP_CONTRACTS,
  HYDROLOGY_SUBSTEP_IDS,
  pickHydrologySubstepInput,
} from './hydrologySubstepContracts.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { runHydrologySubsteps } from './hydrologySubsteps.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 32,
  height: 32,
}

test('HYDROLOGY_SUBSTEP_IDS matches hydrology substep order', () => {
  assert.deepStrictEqual(HYDROLOGY_SUBSTEP_IDS, [
    'hydrologyFill',
    'hydrologyClimate',
    'hydrologySeasonal',
    'hydrologyRoute',
    'hydrologyIncise',
    'hydrologyExtract',
    'hydrologyRefine',
    'hydrologySettle',
    'hydrologyPaint',
  ])
})

test('each hydrology substep contract declares narrow input and output keys', () => {
  for (const substepId of HYDROLOGY_SUBSTEP_IDS) {
    const contract = HYDROLOGY_SUBSTEP_CONTRACTS[substepId]
    assert.ok(contract, `missing contract for ${substepId}`)
    assert.strictEqual(contract.id, substepId)
    assert.ok(contract.label.length > 0)
    assert.ok(contract.inputKeys.length > 0, `${substepId} inputKeys`)
    assert.ok(contract.outputKeys.length > 0, `${substepId} outputKeys`)
  }
})

test('pickHydrologySubstepInput rejects fill without eroded elevation', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')

  const ctx = {
    state,
    width: state.width,
    height: state.height,
    lastCompletedSubstep: null,
    ocean: null,
    lakeMask: null,
    lakes: null,
    lakeMeta: null,
    hydrologyStats: null,
    filledElevation: null,
    spillOutlet: null,
    temperature: null,
    rainfall: null,
    snowCapMask: null,
    meltContribution: null,
    effectiveRunoff: null,
    lakeIdByCell: null,
    catchmentCellsByLake: null,
    overflowLakeIds: null,
    flowDirection: null,
    flowAccumulation: null,
    lakeOcean: null,
    riverNetworkMask: null,
    incisedRiverNetworkMask: null,
    incisedCorridorMask: null,
    channelWidth: null,
    coastNavigability: null,
    settledElevation: null,
    settledRiverNetworkMask: null,
    presentationRiverNetworkMask: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
    riverCorridorMask: null,
    riverNetwork: null,
    hooks: {},
  }

  assert.throws(
    () => pickHydrologySubstepInput('hydrologyFill', ctx),
    /erodedElevation/,
  )
})

test('assertHydrologySubstepOutputs rejects missing substep output at seam', () => {
  const ctx = {
    state: createInitialPipelineState(params),
    width: 8,
    height: 8,
    lastCompletedSubstep: 'hydrologyFill',
    ocean: new Array(64).fill(false),
    lakeMask: new Uint8Array(64),
    lakes: [],
    lakeMeta: [],
    hydrologyStats: { breachCount: 0, endorheicCount: 0, endorheicFraction: 0, lakeCount: 0 },
    filledElevation: new Float32Array(64),
    spillOutlet: new Int32Array(64).fill(-1),
    temperature: null,
    rainfall: null,
    snowCapMask: null,
    meltContribution: null,
    effectiveRunoff: null,
    lakeIdByCell: new Int32Array(64).fill(-1),
    catchmentCellsByLake: [],
    overflowLakeIds: null,
    flowDirection: null,
    flowAccumulation: null,
    lakeOcean: null,
    riverNetworkMask: null,
    incisedRiverNetworkMask: null,
    incisedCorridorMask: null,
    channelWidth: null,
    coastNavigability: null,
    settledElevation: null,
    settledRiverNetworkMask: null,
    presentationRiverNetworkMask: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
    riverCorridorMask: null,
    riverNetwork: null,
    hooks: {},
  }

  assert.throws(
    () => assertHydrologySubstepOutputs('hydrologyClimate', ctx),
    /hydrologyClimate missing output temperature/,
  )
})

test('pickHydrologySubstepInput rejects climate before fill', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const ctx = {
    state,
    width: state.width,
    height: state.height,
    lastCompletedSubstep: null,
    ocean: null,
    lakeMask: null,
    lakes: null,
    lakeMeta: null,
    hydrologyStats: null,
    filledElevation: null,
    spillOutlet: null,
    temperature: null,
    rainfall: null,
    snowCapMask: null,
    meltContribution: null,
    effectiveRunoff: null,
    lakeIdByCell: null,
    catchmentCellsByLake: null,
    overflowLakeIds: null,
    flowDirection: null,
    flowAccumulation: null,
    lakeOcean: null,
    riverNetworkMask: null,
    incisedRiverNetworkMask: null,
    incisedCorridorMask: null,
    channelWidth: null,
    coastNavigability: null,
    settledElevation: null,
    settledRiverNetworkMask: null,
    presentationRiverNetworkMask: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
    riverCorridorMask: null,
    riverNetwork: null,
    hooks: {},
  }

  assert.throws(
    () => pickHydrologySubstepInput('hydrologyClimate', ctx),
    /hydrologyFill/,
  )
})

test('pickHydrologySubstepInput rejects route before seasonal', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const ctx = {
    state,
    width: state.width,
    height: state.height,
    lastCompletedSubstep: 'hydrologyClimate',
    ocean: new Array(state.width * state.height).fill(false),
    lakeMask: new Uint8Array(state.width * state.height),
    lakes: [],
    lakeMeta: [],
    hydrologyStats: { breachCount: 0, endorheicCount: 0, endorheicFraction: 0, lakeCount: 0 },
    filledElevation: state.erodedElevation,
    spillOutlet: new Int32Array(state.width * state.height).fill(-1),
    temperature: new Float32Array(state.width * state.height),
    rainfall: new Float32Array(state.width * state.height),
    snowCapMask: new Uint8Array(state.width * state.height),
    meltContribution: new Float32Array(state.width * state.height),
    effectiveRunoff: null,
    lakeIdByCell: new Int32Array(state.width * state.height).fill(-1),
    catchmentCellsByLake: [],
    overflowLakeIds: null,
    flowDirection: null,
    flowAccumulation: null,
    lakeOcean: null,
    riverNetworkMask: null,
    incisedRiverNetworkMask: null,
    incisedCorridorMask: null,
    channelWidth: null,
    coastNavigability: null,
    settledElevation: null,
    settledRiverNetworkMask: null,
    presentationRiverNetworkMask: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
    riverCorridorMask: null,
    riverNetwork: null,
    hooks: {},
  }

  assert.throws(
    () => pickHydrologySubstepInput('hydrologyRoute', ctx),
    /hydrologySeasonal/,
  )
})

test('runHydrologySubsteps validates substep inputs at seam', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {string[]} */
  const prepared = []
  runHydrologySubsteps(state, {
    onSubstepPrepare({ substepId, input }) {
      prepared.push(substepId)
      const contract = HYDROLOGY_SUBSTEP_CONTRACTS[substepId]
      assert.deepStrictEqual(Object.keys(input).sort(), [...contract.inputKeys].sort())
    },
  })

  assert.deepStrictEqual(prepared, [...HYDROLOGY_SUBSTEP_IDS])
})
