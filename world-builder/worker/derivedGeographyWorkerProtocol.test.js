import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSlimWorkerStepCompleteMessage,
  toWorkerCancelledMessage,
  toWorkerCompleteMessage,
  toWorkerErrorMessage,
  toWorkerExhaustedMessage,
  toWorkerStepCompleteMessage,
  toWorkerSubstepPrepareMessage,
  toWorkerTerminalMessage,
} from './derivedGeographyWorkerProtocol.js'
import { createDerivedGeographyWorkerPipelineCallbacks } from './createDerivedGeographyWorkerPipelineCallbacks.js'

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
