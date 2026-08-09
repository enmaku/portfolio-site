import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneWorldDocument } from '../core/cloneWorldDocument.js'
import {
  buildWorldDocumentFromPipelineState,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runLandmassPipeline,
  runPipelineStep,
} from '../core/derivedGeographyPipeline.js'
import { countMarkedCells } from '../core/hydrology/riverNetwork.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'
import {
  isMapPreviewWorldDocumentDelivery,
  isSlimWorkerStepCompleteMessage,
  simulationRiverMaskIsIndependentFromPresentationMasks,
  toWorkerCancelledMessage,
  toWorkerCompleteMessage,
  toWorkerErrorMessage,
  toWorkerExhaustedMessage,
  toWorkerStepCompleteMessage,
  toWorkerSubstepPrepareMessage,
  toWorkerTerminalMessage,
  worldDocumentHasSimulationRiverMask,
} from './derivedGeographyWorkerProtocol.js'
import { createDerivedGeographyWorkerPipelineCallbacks } from './createDerivedGeographyWorkerPipelineCallbacks.js'

const workerParams = {
  geographySeed: 42,
  prevailingWindDegrees: 90,
  width: 8,
  height: 8,
  options: DEFAULT_WORLD_GENERATION_OPTIONS,
}

const meanderPreviewParams = {
  geographySeed: 5000,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
  options: {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
    riverMeanderStrength: 2,
  },
}

/**
 * @param {{ isCancelled?: () => boolean }} [options]
 */
function collectWorkerMessages(options = {}) {
  /** @type {unknown[]} */
  const posted = []
  const callbacks = createDerivedGeographyWorkerPipelineCallbacks({
    postMessage: (message) => posted.push(message),
    isCancelled: options.isCancelled ?? (() => false),
  })
  return { posted, callbacks }
}

test('toWorkerStepCompleteMessage omits pipeline state and keeps optional world document', () => {
  const worldDocument = { gridWidth: 4, gridHeight: 4, pipelineStage: 'derivedGeography' }
  const message = toWorkerStepCompleteMessage({
    stepId: 'validation',
    stepIndex: 5,
    stepCount: 6,
    label: 'Validation',
    state: { fields: new Float32Array(16), riverGraph: { nodes: [] } },
    worldDocument,
  })

  assert.deepStrictEqual(message, {
    type: 'step-complete',
    stepId: 'validation',
    stepIndex: 5,
    stepCount: 6,
    label: 'Validation',
    worldDocument,
  })
  assert.ok(isSlimWorkerStepCompleteMessage(message))
})

test('toWorkerStepCompleteMessage omits worldDocument when preview is not attached', () => {
  const message = toWorkerStepCompleteMessage({
    stepId: 'erosion',
    stepIndex: 1,
    stepCount: 6,
    label: 'Erosion',
    state: { fields: new Float32Array(16) },
    worldDocument: undefined,
  })

  assert.deepStrictEqual(message, {
    type: 'step-complete',
    stepId: 'erosion',
    stepIndex: 1,
    stepCount: 6,
    label: 'Erosion',
  })
  assert.ok(isSlimWorkerStepCompleteMessage(message))
})

test('toWorkerSubstepPrepareMessage forwards hydrology contract input', () => {
  const message = toWorkerSubstepPrepareMessage({
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 9,
    label: 'Fill',
    input: { width: 8, height: 8, workingElevation: new Float32Array(64) },
  })

  assert.deepStrictEqual(message, {
    type: 'substep-prepare',
    stepId: 'hydrology',
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 9,
    label: 'Fill',
    input: { width: 8, height: 8, workingElevation: new Float32Array(64) },
  })
})

test('terminal worker messages match completion contract', () => {
  const worldDocument = { gridWidth: 2, gridHeight: 2, pipelineStage: 'derivedGeography' }
  assert.deepStrictEqual(toWorkerCompleteMessage(), { type: 'complete' })
  assert.deepStrictEqual(toWorkerExhaustedMessage(worldDocument), {
    type: 'exhausted',
    worldDocument,
  })
  assert.deepStrictEqual(toWorkerCancelledMessage(), { type: 'cancelled' })
  assert.deepStrictEqual(toWorkerErrorMessage('pipeline failed'), {
    type: 'error',
    message: 'pipeline failed',
  })
})

test('isSlimWorkerStepCompleteMessage rejects legacy step-complete payloads with pipeline state', () => {
  assert.strictEqual(
    isSlimWorkerStepCompleteMessage({
      type: 'step-complete',
      stepId: 'hydrology',
      stepIndex: 2,
      stepCount: 6,
      label: 'Hydrology',
      state: { fields: new Float32Array(16) },
    }),
    false,
  )
})

test('toWorkerTerminalMessage maps pipeline run results to completion contract terminals', () => {
  const worldDocument = { gridWidth: 2, gridHeight: 2, pipelineStage: 'derivedGeography' }
  assert.deepStrictEqual(toWorkerTerminalMessage({ status: 'success', worldDocument }), {
    type: 'complete',
  })
  assert.deepStrictEqual(toWorkerTerminalMessage({ status: 'exhausted', worldDocument }), {
    type: 'exhausted',
    worldDocument,
  })
  assert.deepStrictEqual(toWorkerTerminalMessage({ status: 'cancelled', worldDocument: null }), {
    type: 'cancelled',
  })
  assert.deepStrictEqual(
    toWorkerTerminalMessage({ status: 'error', worldDocument: null, errorMessage: 'boom' }),
    { type: 'error', message: 'boom' },
  )
})

test('worker pipeline callbacks post slim step-complete payloads', async () => {
  /** @type {unknown[]} */
  const posted = []
  const callbacks = createDerivedGeographyWorkerPipelineCallbacks({
    postMessage: (message) => posted.push(message),
    isCancelled: () => false,
  })

  callbacks.onStepComplete({
    stepId: 'hydrology',
    stepIndex: 2,
    stepCount: 6,
    label: 'Hydrology',
    state: { fields: new Float32Array(16), riverGraph: { nodes: [] } },
  })

  assert.strictEqual(posted.length, 1)
  assert.ok(isSlimWorkerStepCompleteMessage(posted[0]))
})

test('worker pipeline callbacks forward substep-prepare for hydrology contract hooks', async () => {
  /** @type {unknown[]} */
  const posted = []
  const callbacks = createDerivedGeographyWorkerPipelineCallbacks({
    postMessage: (message) => posted.push(message),
    isCancelled: () => false,
  })

  callbacks.onSubstepPrepare?.({
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 9,
    label: 'Fill',
    input: { width: 8, height: 8 },
  })

  assert.strictEqual(posted.length, 1)
  assert.deepStrictEqual(posted[0], {
    type: 'substep-prepare',
    stepId: 'hydrology',
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 9,
    label: 'Fill',
    input: { width: 8, height: 8 },
  })
})

test('worker pipeline callbacks suppress messages after cancellation', () => {
  let cancelled = false
  /** @type {unknown[]} */
  const posted = []
  const callbacks = createDerivedGeographyWorkerPipelineCallbacks({
    postMessage: (message) => posted.push(message),
    isCancelled: () => cancelled,
  })

  callbacks.onStepStart({
    stepId: 'physicalTerrainBaseline',
    stepIndex: 0,
    stepCount: 6,
    label: 'Baseline',
  })
  cancelled = true
  callbacks.onStepComplete({
    stepId: 'physicalTerrainBaseline',
    stepIndex: 0,
    stepCount: 6,
    label: 'Baseline',
    state: {},
  })

  assert.strictEqual(posted.length, 1)
  assert.strictEqual(/** @type {{ type: string }} */ (posted[0]).type, 'step-start')
})

/** @type {import('../core/types.js').WorldDocument} */
const SAMPLE_DOC = {
  gridWidth: 2,
  gridHeight: 2,
  biomes: new Uint8Array(4),
  fields: { elevation: new Float32Array(4) },
}

test('isMapPreviewWorldDocumentDelivery accepts validation step-complete with world document', () => {
  assert.strictEqual(
    isMapPreviewWorldDocumentDelivery({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: SAMPLE_DOC,
    }),
    true,
  )
})

test('isMapPreviewWorldDocumentDelivery rejects step-complete without world document', () => {
  assert.strictEqual(
    isMapPreviewWorldDocumentDelivery({ delivery: 'step-complete', stepId: 'validation' }),
    false,
  )
})

test('isMapPreviewWorldDocumentDelivery rejects non-validation step-complete even with world document', () => {
  for (const stepId of ['physicalTerrainBaseline', 'erosion', 'hydrology', 'fieldRefresh', 'coastAndResources']) {
    assert.strictEqual(
      isMapPreviewWorldDocumentDelivery({
        delivery: 'step-complete',
        stepId,
        worldDocument: SAMPLE_DOC,
      }),
      false,
      stepId,
    )
  }
})

test('isMapPreviewWorldDocumentDelivery accepts exhausted terminal with world document', () => {
  assert.strictEqual(
    isMapPreviewWorldDocumentDelivery({
      delivery: 'exhausted',
      worldDocument: { ...SAMPLE_DOC, generationReport: { shouldReject: true } },
    }),
    true,
  )
})

test('isMapPreviewWorldDocumentDelivery rejects exhausted terminal without world document', () => {
  assert.strictEqual(isMapPreviewWorldDocumentDelivery({ delivery: 'exhausted' }), false)
})

test('worldDocumentHasSimulationRiverMask requires a non-empty Uint8Array', () => {
  assert.strictEqual(worldDocumentHasSimulationRiverMask(null), false)
  assert.strictEqual(worldDocumentHasSimulationRiverMask({ gridWidth: 2, gridHeight: 2 }), false)
  assert.strictEqual(
    worldDocumentHasSimulationRiverMask({ simulationRiverMask: new Uint8Array(0) }),
    false,
  )
  assert.strictEqual(
    worldDocumentHasSimulationRiverMask({ simulationRiverMask: new Uint8Array(4) }),
    true,
  )
})

test('simulationRiverMaskIsIndependentFromPresentationMasks rejects shared mask references', () => {
  const shared = new Uint8Array(4)
  assert.strictEqual(
    simulationRiverMaskIsIndependentFromPresentationMasks({
      simulationRiverMask: shared,
      riverNetworkMask: shared,
    }),
    false,
  )
  assert.strictEqual(
    simulationRiverMaskIsIndependentFromPresentationMasks({
      simulationRiverMask: new Uint8Array(4),
      riverNetworkMask: new Uint8Array(4),
    }),
    true,
  )
})

test('worker validation step-complete payload carries populated simulationRiverMask', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  const result = await runLandmassPipeline(workerParams, callbacks)

  assert.strictEqual(result.status, 'success')
  const validationComplete = posted.find(
    (message) =>
      /** @type {{ type?: string, stepId?: string }} */ (message).type === 'step-complete' &&
      /** @type {{ stepId?: string }} */ (message).stepId === 'validation',
  )
  const worldDocument = /** @type {{ worldDocument?: import('../core/types.js').WorldDocument }} */ (
    validationComplete
  ).worldDocument
  assert.ok(worldDocument)
  assert.ok(worldDocumentHasSimulationRiverMask(worldDocument))
  assert.ok(simulationRiverMaskIsIndependentFromPresentationMasks(worldDocument))
  assert.ok(countMarkedCells(worldDocument.simulationRiverMask) > 0)
})

test('worker exhausted terminal payload carries populated simulationRiverMask', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  const result = await runLandmassPipeline(
    {
      geographySeed: 999999,
      prevailingWindDegrees: 270,
      width: 16,
      height: 16,
      options: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastConnectedNavigablePath: true,
        minCoastConnectedNavigablePathCells: 99_999,
        maxValidationRetries: 0,
      },
    },
    callbacks,
  )

  assert.strictEqual(result.status, 'exhausted')
  posted.push(toWorkerTerminalMessage(result))
  const terminal = posted.at(-1)
  const worldDocument = /** @type {{ worldDocument?: import('../core/types.js').WorldDocument }} */ (
    terminal
  ).worldDocument
  assert.ok(worldDocument)
  assert.ok(worldDocumentHasSimulationRiverMask(worldDocument))
})

test('cloneWorldDocument deep-copies simulationRiverMask independently from presentation masks', () => {
  const doc = runPipelineStep(
    runPipelineStep(
      runPipelineStep(createInitialPipelineState(workerParams), 'physicalTerrainBaseline'),
      'erosion',
    ),
    'hydrology',
  )
  const source = buildWorldDocumentFromPipelineState(doc)
  const cloned = cloneWorldDocument(source)

  assert.ok(source.simulationRiverMask)
  assert.ok(source.riverNetworkMask)
  assert.ok(cloned.simulationRiverMask)
  assert.ok(cloned.riverNetworkMask)
  assert.notStrictEqual(cloned.simulationRiverMask, source.simulationRiverMask)
  assert.notStrictEqual(cloned.riverNetworkMask, source.riverNetworkMask)
  assert.ok(simulationRiverMaskIsIndependentFromPresentationMasks(cloned))

  const originalSimulation = cloned.simulationRiverMask[0]
  cloned.simulationRiverMask[0] = originalSimulation === 0 ? 1 : 0
  assert.notStrictEqual(cloned.simulationRiverMask[0], source.simulationRiverMask[0])
  assert.strictEqual(cloned.riverNetworkMask[0], source.riverNetworkMask[0])

  cloned.riverNetworkMask[1] = source.riverNetworkMask[1] === 0 ? 1 : 0
  assert.notStrictEqual(cloned.riverNetworkMask[1], source.riverNetworkMask[1])
  assert.strictEqual(cloned.simulationRiverMask[1], source.simulationRiverMask[1])
})

test('worker preview clone retains simulationRiverMask when meander widens presentation masks', () => {
  let state = createInitialPipelineState(meanderPreviewParams)
  for (const step of DERIVED_GEOGRAPHY_STEPS) {
    state = runPipelineStep(state, step.id)
  }

  const preview = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
  assert.ok(preview.simulationRiverMask)
  assert.ok(preview.riverNetworkMask)
  assert.ok(worldDocumentHasSimulationRiverMask(preview))
  assert.ok(simulationRiverMaskIsIndependentFromPresentationMasks(preview))
  assert.ok(countMarkedCells(preview.simulationRiverMask) > 0)
  assert.notStrictEqual(
    countMarkedCells(preview.simulationRiverMask),
    countMarkedCells(preview.riverNetworkMask),
    'preview must keep settled simulation bytes when presentation centerline diverges',
  )
})
