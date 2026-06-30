import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

/** @returns {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} */
function createErodedPipelineState() {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  return runPipelineStep(state, 'erosion')
}

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {Partial<import('./hydrologySubsteps.js').HydrologySubstepContext>} overrides
 */
function createHydrologyTestContext(state, overrides = {}) {
  return {
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
    incisedCorridorMask: null,
    channelWidth: null,
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
    flowFieldSession: { fullFlowSolveCount: 0, solveLog: [] },
    ...overrides,
  }
}

/** @param {number} cellCount */
function createFilledHydrologyFixtures(cellCount) {
  return {
    ocean: new Array(cellCount).fill(false),
    lakeMask: new Uint8Array(cellCount),
    lakes: [],
    lakeMeta: [],
    hydrologyStats: { breachCount: 0, endorheicCount: 0, endorheicFraction: 0, lakeCount: 0 },
    spillOutlet: new Int32Array(cellCount).fill(-1),
    temperature: new Float32Array(cellCount),
    rainfall: new Float32Array(cellCount),
    snowCapMask: new Uint8Array(cellCount),
    meltContribution: new Float32Array(cellCount),
    effectiveRunoff: new Float32Array(cellCount),
    lakeIdByCell: new Int32Array(cellCount).fill(-1),
    catchmentCellsByLake: [],
    overflowLakeIds: new Set(),
    flowDirection: new Int16Array(cellCount),
    flowAccumulation: new Float32Array(cellCount),
    lakeOcean: new Array(cellCount).fill(false),
    riverNetworkMask: new Uint8Array(cellCount),
    incisedCorridorMask: new Uint8Array(cellCount),
    channelWidth: new Float32Array(cellCount),
    settledFlowDirection: new Int16Array(cellCount),
    settledFlowAccumulation: new Float32Array(cellCount),
    settledOcean: new Array(cellCount).fill(false),
    settledRiverNetworkMask: new Uint8Array(cellCount),
    settledRiverGraph: { nodes: [], edges: [] },
  }
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

test('hydrology contracts omit orphaned waterway navigability outputs', () => {
  const incise = HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyIncise
  const extract = HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyExtract

  assert.ok(!incise.outputKeys.includes('incisedRiverNetworkMask'))
  assert.ok(!extract.outputKeys.includes('coastNavigability'))
  assert.ok(!extract.inputKeys.includes('coastNavigability'))
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
    incisedCorridorMask: null,
    channelWidth: null,
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
    /hydrologyFill missing input erodedElevation/,
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
    incisedCorridorMask: null,
    channelWidth: null,
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
    incisedCorridorMask: null,
    channelWidth: null,
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
    incisedCorridorMask: null,
    channelWidth: null,
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

test('runHydrologySubsteps rejects missing eroded elevation via contract picker', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')

  assert.throws(
    () => runHydrologySubsteps(state),
    /hydrologyFill missing input erodedElevation/,
  )
})

const hydrologySubstepsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'hydrologySubsteps.js',
)

const hydrologySubstepContractsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'hydrologySubstepContracts.js',
)

test('createHydrologyContext does not duplicate erosion precondition', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  const contextBlock = source.slice(
    source.indexOf('function createHydrologyContext'),
    source.indexOf('function runHydrologyFillSubstep'),
  )
  assert.deepStrictEqual(contextBlock.match(/throw new Error/g) ?? [], [])
})

test('buildPipelineStateFromHydrologyContext does not duplicate output validation', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  const buildBlock = source.slice(
    source.indexOf('function buildPipelineStateFromHydrologyContext'),
    source.indexOf('function shouldSkipHydrologySubstep'),
  )
  assert.ok(
    !buildBlock.includes('Incomplete hydrology context'),
    'buildPipelineStateFromHydrologyContext must rely on assertHydrologySubstepOutputs',
  )
  assert.ok(
    !buildBlock.includes('!ctx.'),
    'buildPipelineStateFromHydrologyContext must not null-guard ctx outputs',
  )
})

test('hydrology substep runners contain no parallel precondition guards', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  const runnerBlock = source.slice(source.indexOf('function runHydrologyFillSubstep'))
  const runnerPreconditionThrows =
    runnerBlock.match(/throw new Error\([^)]*required before/g) ?? []
  assert.deepStrictEqual(runnerPreconditionThrows, [])
})

test('hydrology substep runners contain no ctx null-guard blocks', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  const runnerStart = source.indexOf('function runHydrologyFillSubstep')
  const runnerEnd = source.indexOf('function buildPipelineStateFromHydrologyContext')
  const runnerBlock = source.slice(runnerStart, runnerEnd)
  assert.ok(
    !runnerBlock.includes('!ctx.'),
    'runners must delegate preconditions to pickHydrologySubstepInput',
  )
})

test('pickHydrologySubstepInput reports missing route inputs by contract key name', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const ctx = {
    state,
    width: state.width,
    height: state.height,
    lastCompletedSubstep: 'hydrologySeasonal',
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
    incisedCorridorMask: null,
    channelWidth: null,
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
    /hydrologyRoute missing input effectiveRunoff/,
  )
})

test('pickHydrologySubstepInput has no per-substep switch validation', () => {
  const source = readFileSync(hydrologySubstepContractsPath, 'utf8')
  const pickerStart = source.indexOf('export function pickHydrologySubstepInput')
  const pickerEnd = source.indexOf('export function assertHydrologySubstepOutputs')
  const pickerBlock = source.slice(pickerStart, pickerEnd)
  assert.ok(
    !pickerBlock.includes("case 'hydrology"),
    'picker must validate via contract.inputKeys, not per-substep switch guards',
  )
  assert.ok(
    !pickerBlock.includes('outputs required before'),
    'picker must use prerequisite chain, not bundled output guards',
  )
})

test('hydrologySubsteps delegates validation exclusively to contract picker and assertion', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  assert.ok(
    !source.includes('missing input'),
    'hydrologySubsteps must not emit pickHydrologySubstepInput error messages',
  )
  assert.ok(
    !source.includes('missing output'),
    'hydrologySubsteps must not emit assertHydrologySubstepOutputs error messages',
  )
  assert.ok(
    !source.includes('required before hydrology'),
    'hydrologySubsteps must not emit prerequisite error messages',
  )
  assert.ok(
    !source.includes('Incomplete hydrology context'),
    'hydrologySubsteps must not duplicate post-pipeline output validation',
  )
})

test('hydrology substep runners do not emit contract validation error messages', () => {
  const source = readFileSync(hydrologySubstepsPath, 'utf8')
  const runnerStart = source.indexOf('function runHydrologyFillSubstep')
  const runnerEnd = source.indexOf('function buildPipelineStateFromHydrologyContext')
  const runnerBlock = source.slice(runnerStart, runnerEnd)
  assert.ok(
    !runnerBlock.includes('missing input'),
    'runners must not duplicate pickHydrologySubstepInput errors',
  )
  assert.ok(
    !runnerBlock.includes('missing output'),
    'runners must not duplicate assertHydrologySubstepOutputs errors',
  )
})

test('pickHydrologySubstepInput rejects incise extract refine settle paint out of prerequisite order', () => {
  const state = createErodedPipelineState()
  const cellCount = state.width * state.height
  const fixtures = createFilledHydrologyFixtures(cellCount)

  /** @type {Array<[import('./hydrologySubsteps.js').HydrologySubstepId, import('./hydrologySubsteps.js').HydrologySubstepId | null, import('./hydrologySubsteps.js').HydrologySubstepId]>} */
  const cases = [
    ['hydrologyIncise', 'hydrologySeasonal', 'hydrologyRoute'],
    ['hydrologyExtract', 'hydrologyRoute', 'hydrologyIncise'],
    ['hydrologyRefine', 'hydrologyIncise', 'hydrologyExtract'],
    ['hydrologySettle', 'hydrologyExtract', 'hydrologyRefine'],
    ['hydrologyPaint', 'hydrologyRefine', 'hydrologySettle'],
  ]

  for (const [substepId, lastCompletedSubstep, expectedPrerequisite] of cases) {
    const ctx = createHydrologyTestContext(state, {
      ...fixtures,
      filledElevation: state.erodedElevation,
      settledElevation: state.erodedElevation,
      lastCompletedSubstep,
    })

    assert.throws(
      () => pickHydrologySubstepInput(substepId, ctx),
      new RegExp(`${expectedPrerequisite} required before ${substepId}`),
      `${substepId} prerequisite message`,
    )
  }
})

test('pickHydrologySubstepInput reports missing incise extract refine settle paint inputs by contract key name', () => {
  const state = createErodedPipelineState()
  const cellCount = state.width * state.height
  const fixtures = createFilledHydrologyFixtures(cellCount)

  /** @type {Array<[import('./hydrologySubsteps.js').HydrologySubstepId, import('./hydrologySubsteps.js').HydrologySubstepId, string, Record<string, unknown>]>} */
  const cases = [
    [
      'hydrologyIncise',
      'hydrologyRoute',
      'flowDirection',
      { flowDirection: null, riverNetworkMask: new Uint8Array(cellCount) },
    ],
    [
      'hydrologyExtract',
      'hydrologyIncise',
      'settledElevation',
      { settledElevation: null, incisedCorridorMask: new Uint8Array(cellCount) },
    ],
    [
      'hydrologyRefine',
      'hydrologyExtract',
      'settledRiverNetworkMask',
      {
        settledElevation: state.erodedElevation,
        settledRiverNetworkMask: null,
      },
    ],
    [
      'hydrologySettle',
      'hydrologyRefine',
      'settledFlowAccumulation',
      {
        settledElevation: state.erodedElevation,
        settledFlowAccumulation: null,
        lakes: [],
        lakeMeta: [],
      },
    ],
    [
      'hydrologyPaint',
      'hydrologySettle',
      'settledRiverGraph',
      {
        settledElevation: state.erodedElevation,
        settledRiverGraph: null,
      },
    ],
  ]

  for (const [substepId, lastCompletedSubstep, missingKey, ctxOverrides] of cases) {
    const ctx = createHydrologyTestContext(state, {
      ...fixtures,
      filledElevation: state.erodedElevation,
      lastCompletedSubstep,
      ...ctxOverrides,
    })

    assert.throws(
      () => pickHydrologySubstepInput(substepId, ctx),
      new RegExp(`${substepId} missing input ${missingKey}`),
      `${substepId} missing ${missingKey}`,
    )
  }
})

test('assertHydrologySubstepOutputs reports missing refine and paint outputs by contract key name', () => {
  const state = createInitialPipelineState(params)
  const cellCount = state.width * state.height

  const refineCtx = createHydrologyTestContext(state, {
    width: 8,
    height: 8,
    lastCompletedSubstep: 'hydrologyExtract',
    settledElevation: new Float32Array(cellCount),
    presentationRiverNetworkMask: null,
  })

  assert.throws(
    () => assertHydrologySubstepOutputs('hydrologyRefine', refineCtx),
    /hydrologyRefine missing output presentationRiverNetworkMask/,
  )

  const paintCtx = createHydrologyTestContext(state, {
    width: 8,
    height: 8,
    lastCompletedSubstep: 'hydrologySettle',
    riverCorridorMask: new Uint8Array(cellCount),
    riverNetwork: null,
  })

  assert.throws(
    () => assertHydrologySubstepOutputs('hydrologyPaint', paintCtx),
    /hydrologyPaint missing output riverNetwork/,
  )
})

test('assertHydrologySubstepOutputs reports missing extract and settle outputs by contract key name', () => {
  const state = createInitialPipelineState(params)
  const cellCount = state.width * state.height

  const extractCtx = createHydrologyTestContext(state, {
    width: 8,
    height: 8,
    lastCompletedSubstep: 'hydrologyIncise',
    settledFlowDirection: new Int16Array(cellCount),
    settledFlowAccumulation: new Float32Array(cellCount),
    settledOcean: new Array(cellCount).fill(false),
    settledRiverNetworkMask: new Uint8Array(cellCount),
    channelWidth: new Float32Array(cellCount),
    settledRiverGraph: null,
  })

  assert.throws(
    () => assertHydrologySubstepOutputs('hydrologyExtract', extractCtx),
    /hydrologyExtract missing output settledRiverGraph/,
  )

  const settleCtx = createHydrologyTestContext(state, {
    width: 8,
    height: 8,
    lastCompletedSubstep: 'hydrologyRefine',
    settledElevation: new Float32Array(cellCount),
    lakes: [],
    lakeMeta: [],
    spillOutlet: new Int32Array(cellCount).fill(-1),
    settledFlowDirection: new Int16Array(cellCount),
    settledFlowAccumulation: new Float32Array(cellCount),
    settledOcean: new Array(cellCount).fill(false),
    channelWidth: new Float32Array(cellCount),
    settledRiverGraph: { nodes: [], edges: [] },
    settledDrainage: null,
  })

  assert.throws(
    () => assertHydrologySubstepOutputs('hydrologySettle', settleCtx),
    /hydrologySettle missing output settledDrainage/,
  )
})
