import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneWorldDocument, runLandmassPipeline } from '../core/derivedGeographyPipeline.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'
import { createDerivedGeographyWorkerPipelineCallbacks } from './createDerivedGeographyWorkerPipelineCallbacks.js'
import {
  isSlimWorkerStepCompleteMessage,
  toWorkerTerminalMessage,
} from './derivedGeographyWorkerProtocol.js'

const workerParams = {
  geographySeed: 42,
  prevailingWindDegrees: 90,
  width: 8,
  height: 8,
  options: DEFAULT_WORLD_GENERATION_OPTIONS,
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

test('worker job completes successfully through shared landmass pipeline runner', async () => {
  /** @type {string[]} */
  const messages = []
  const result = await runLandmassPipeline(workerParams, {
    onStepStart({ stepId }) {
      messages.push(`start:${stepId}`)
    },
    onStepComplete({ stepId, worldDocument }) {
      messages.push(`complete:${stepId}:${Boolean(worldDocument)}`)
    },
  })

  assert.strictEqual(result.status, 'success')
  assert.ok(result.worldDocument)
  assert.ok(messages.includes('start:physicalTerrainBaseline'))
  assert.ok(messages.includes('complete:validation:true'))
  assert.ok(messages.includes('complete:erosion:false'))
})

test('worker job reports cancelled when shouldCancel is set mid-run', async () => {
  let stepStarts = 0
  const result = await runLandmassPipeline(workerParams, {
    onStepStart() {
      stepStarts += 1
    },
    shouldCancel() {
      return stepStarts >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
})

test('worker job reports cancelled when hydrology substep cancellation is requested', async () => {
  let completedSubsteps = 0
  const result = await runLandmassPipeline(workerParams, {
    onSubstepComplete() {
      completedSubsteps += 1
    },
    shouldCancel() {
      return completedSubsteps >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
})

test('worker job reports error when pipeline callback throws', async () => {
  const result = await runLandmassPipeline(workerParams, {
    onStepStart() {
      throw new Error('worker callback failed')
    },
  })

  assert.strictEqual(result.status, 'error')
  assert.match(result.errorMessage ?? '', /worker callback failed/)
})

test('worker job reports exhausted when validation retries are exhausted', async () => {
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
    {
      onStepComplete({ stepId, worldDocument }) {
        if (stepId === 'validation') {
          assert.ok(worldDocument)
        }
      },
    },
  )

  assert.strictEqual(result.status, 'exhausted')
  assert.ok(result.worldDocument)
  assert.strictEqual(result.worldDocument.generationReport?.shouldReject, true)

  const cloned = cloneWorldDocument(result.worldDocument)
  cloned.fields.elevation[0] = -999
  assert.notStrictEqual(result.worldDocument.fields.elevation[0], -999)
})

test('worker job omits intermediate previews unless explicitly enabled', async () => {
  /** @type {boolean[]} */
  const hasDoc = []
  await runLandmassPipeline(workerParams, {
    onStepComplete({ worldDocument }) {
      hasDoc.push(Boolean(worldDocument))
    },
  })

  assert.deepStrictEqual(hasDoc, [false, false, false, false, false, true])
})

test('worker messaging posts slim step-complete payloads on success path', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  const result = await runLandmassPipeline(workerParams, callbacks)

  assert.strictEqual(result.status, 'success')
  const stepCompletes = posted.filter(
    (message) => /** @type {{ type?: string }} */ (message).type === 'step-complete',
  )
  assert.ok(stepCompletes.length > 0)
  for (const message of stepCompletes) {
    assert.ok(isSlimWorkerStepCompleteMessage(message))
  }
  const validationComplete = /** @type {{ worldDocument?: unknown }} */ (
    stepCompletes.at(-1)
  )
  assert.ok(validationComplete.worldDocument)
})

test('worker messaging posts cancelled terminal without pipeline state on step-complete', async () => {
  let stepStarts = 0
  const { posted, callbacks } = collectWorkerMessages({
    isCancelled: () => stepStarts >= 2,
  })

  const result = await runLandmassPipeline(workerParams, {
    ...callbacks,
    onStepStart(payload) {
      stepStarts += 1
      callbacks.onStepStart?.(payload)
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  for (const message of posted) {
    if (/** @type {{ type?: string }} */ (message).type === 'step-complete') {
      assert.ok(isSlimWorkerStepCompleteMessage(message))
    }
  }
})

test('worker messaging posts slim payloads when hydrology cancellation is requested', async () => {
  let completedSubsteps = 0
  const { posted, callbacks } = collectWorkerMessages({
    isCancelled: () => completedSubsteps >= 2,
  })

  const result = await runLandmassPipeline(workerParams, {
    ...callbacks,
    onSubstepComplete(payload) {
      completedSubsteps += 1
      callbacks.onSubstepComplete?.(payload)
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  for (const message of posted) {
    if (/** @type {{ type?: string }} */ (message).type === 'step-complete') {
      assert.ok(isSlimWorkerStepCompleteMessage(message))
    }
  }
})

test('worker messaging keeps step-complete slim when a callback throws', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  const result = await runLandmassPipeline(workerParams, {
    ...callbacks,
    onStepStart() {
      throw new Error('worker callback failed')
    },
  })

  assert.strictEqual(result.status, 'error')
  for (const message of posted) {
    if (/** @type {{ type?: string }} */ (message).type === 'step-complete') {
      assert.ok(isSlimWorkerStepCompleteMessage(message))
    }
  }
})

test('worker messaging forwards substep-prepare through hydrology', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  await runLandmassPipeline(workerParams, callbacks)

  const prepared = posted.filter(
    (message) => /** @type {{ type?: string }} */ (message).type === 'substep-prepare',
  )
  assert.ok(prepared.length > 0)
  assert.strictEqual(/** @type {{ substepId: string }} */ (prepared[0]).substepId, 'hydrologyFill')
})

test('worker success terminal posts metadata-only complete after validation step-complete', async () => {
  const { posted, callbacks } = collectWorkerMessages()
  const result = await runLandmassPipeline(workerParams, callbacks)

  assert.strictEqual(result.status, 'success')
  posted.push(toWorkerTerminalMessage(result))

  const validationComplete = posted.find(
    (message) =>
      /** @type {{ type?: string, stepId?: string }} */ (message).type === 'step-complete' &&
      /** @type {{ stepId?: string }} */ (message).stepId === 'validation',
  )
  assert.ok(/** @type {{ worldDocument?: unknown }} */ (validationComplete).worldDocument)

  const terminal = posted.at(-1)
  assert.deepStrictEqual(terminal, { type: 'complete' })
  assert.strictEqual('worldDocument' in /** @type {Record<string, unknown>} */ (terminal), false)
})

test('worker exhausted terminal posts world document on exhausted not complete', async () => {
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
  assert.strictEqual(/** @type {{ type?: string }} */ (terminal).type, 'exhausted')
  assert.ok(/** @type {{ worldDocument?: unknown }} */ (terminal).worldDocument)
  assert.ok(
    !posted.some(
      (message) => /** @type {{ type?: string }} */ (message).type === 'complete',
    ),
  )
})
