import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { createInitialGenerationProgress } from '../../world-builder/worldBuilderGenerationOrchestrator.js'
import { useWorldBuilderGeneration } from './useWorldBuilderGeneration.js'

/** @type {import('../../world-builder/core/types.js').DerivedGeographyParams} */
const SAMPLE_PARAMS = { geographySeed: 1, prevailingWindDegrees: 90, options: {} }

/**
 * @param {import('vue').EffectScope} scope
 * @param {{
 *   getDerivedGeographyParams?: () => import('../../world-builder/core/types.js').DerivedGeographyParams | null,
 *   applyWorldDocument?: (doc: unknown) => void | Promise<void>,
 *   onRunError?: (message: string) => void,
 *   runDerivedGeographyInWorker?: (
 *     params: import('../../world-builder/core/types.js').DerivedGeographyParams,
 *     callbacks: import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks,
 *   ) => { cancel: () => void },
 * }} [overrides]
 */
function mountGeneration(scope, overrides = {}) {
  const errors = []
  return scope.run(() =>
    useWorldBuilderGeneration({
      getDerivedGeographyParams: overrides.getDerivedGeographyParams ?? (() => SAMPLE_PARAMS),
      applyWorldDocument: overrides.applyWorldDocument ?? (() => {}),
      onRunError: overrides.onRunError ?? ((message) => errors.push(message)),
      runDerivedGeographyInWorker: overrides.runDerivedGeographyInWorker,
    }),
  )
}

test('metadata-only step-complete does not update world document or apply map', async () => {
  const scope = effectScope(true)
  try {
    let applyCount = 0
    const ctx = mountGeneration(scope, {
      applyWorldDocument: () => {
        applyCount += 1
      },
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onStepComplete?.({
          stepId: 'erosion',
          stepIndex: 1,
          stepCount: 6,
          label: 'Erosion',
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.worldDocument.value, null)
    assert.strictEqual(applyCount, 0)
    assert.strictEqual(ctx.runPhase.value, 'success')
  } finally {
    scope.stop()
  }
})

test('complete, cancelled, and error terminals do not apply map', async () => {
  const scope = effectScope(true)
  try {
    let applyCount = 0
    const doc = {
      gridWidth: 2,
      gridHeight: 2,
      biomes: new Uint8Array(4),
      fields: { elevation: new Float32Array(4) },
    }

    for (const terminal of [
      {
        name: 'complete-only',
        run(callbacks) {
          callbacks.onComplete?.()
        },
      },
      {
        name: 'cancelled',
        run(callbacks) {
          callbacks.onCancelled?.()
        },
      },
      {
        name: 'error',
        run(callbacks) {
          callbacks.onError?.('worker failed')
        },
      },
    ]) {
      applyCount = 0
      const ctx = mountGeneration(scope, {
        applyWorldDocument: () => {
          applyCount += 1
        },
        runDerivedGeographyInWorker(_params, callbacks) {
          terminal.run(callbacks)
          return { cancel() {} }
        },
      })

      ctx.regenerate()
      await nextTick()

      assert.strictEqual(ctx.worldDocument.value, null, terminal.name)
      assert.strictEqual(applyCount, 0, terminal.name)
    }

    const successCtx = mountGeneration(scope, {
      applyWorldDocument: () => {
        applyCount += 1
      },
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: doc,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    applyCount = 0
    successCtx.regenerate()
    await nextTick()

    assert.strictEqual(successCtx.worldDocument.value, doc)
    assert.strictEqual(applyCount, 1, 'validation step-complete delivers once before complete')
  } finally {
    scope.stop()
  }
})

test('onWorldDocument stores world document ref before applyWorldDocument', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/core/types.js').WorldDocument | null} */
    let appliedDoc = null
    const doc = {
      gridWidth: 2,
      gridHeight: 2,
      biomes: new Uint8Array(4),
      fields: { elevation: new Float32Array(4) },
    }

    const ctx = mountGeneration(scope, {
      applyWorldDocument: (nextDoc) => {
        appliedDoc = nextDoc
      },
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: doc,
        })
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.worldDocument.value, doc)
    assert.strictEqual(appliedDoc, doc)
  } finally {
    scope.stop()
  }
})

test('regenerate completes with success run phase and shows overlay bar', async () => {
  const scope = effectScope(true)
  try {
    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'success')
    assert.strictEqual(ctx.isGenerating.value, false)
    assert.strictEqual(ctx.showGenerationProgress.value, false)
    assert.strictEqual(ctx.showResourceOverlayBar.value, true)
    assert.strictEqual(ctx.showValidationFailureIndicator.value, false)
  } finally {
    scope.stop()
  }
})

test('regenerate completes with exhausted run phase and validation banner', async () => {
  const scope = effectScope(true)
  try {
    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onExhausted?.(null)
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'exhausted')
    assert.strictEqual(ctx.isGenerating.value, false)
    assert.strictEqual(ctx.showResourceOverlayBar.value, false)
    assert.strictEqual(ctx.showValidationFailureIndicator.value, true)
  } finally {
    scope.stop()
  }
})

test('dispose via cancelActive leaves run phase cancelled and resets progress', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let callbacks = {}

    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, workerCallbacks) {
        callbacks = workerCallbacks
        workerCallbacks.onStepStart?.({
          stepId: 'baseline',
          stepIndex: 2,
          stepCount: 6,
          label: 'Baseline',
        })
        return {
          cancel() {
            callbacks.onCancelled?.()
          },
        }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(ctx.generationProgress.value.activeStepIndex, 2)

    ctx.dispose()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'cancelled')
    assert.strictEqual(ctx.isGenerating.value, false)
    assert.deepStrictEqual(ctx.generationProgress.value, createInitialGenerationProgress())
  } finally {
    scope.stop()
  }
})

test('worker onError sets run phase error and forwards message', async () => {
  const scope = effectScope(true)
  try {
    const errors = []
    const ctx = mountGeneration(scope, {
      onRunError: (message) => errors.push(message),
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onError?.('worker failed')
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'error')
    assert.strictEqual(ctx.isGenerating.value, false)
    assert.deepStrictEqual(errors, ['worker failed'])
  } finally {
    scope.stop()
  }
})

test('applyWorldDocument rejection sets run phase error', async () => {
  const scope = effectScope(true)
  try {
    const errors = []
    const ctx = mountGeneration(scope, {
      onRunError: (message) => errors.push(message),
      applyWorldDocument: async () => {
        throw new Error('map apply failed')
      },
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: {
            gridWidth: 4,
            gridHeight: 4,
            biomes: new Uint8Array(16),
            fields: { elevation: new Float32Array(16) },
          },
        })
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'error')
    assert.ok(errors.some((message) => message.includes('map apply failed')))
  } finally {
    scope.stop()
  }
})

test('regenerate skips when geography params are unavailable', async () => {
  const scope = effectScope(true)
  try {
    let workerCalls = 0
    const ctx = mountGeneration(scope, {
      getDerivedGeographyParams: () => null,
      runDerivedGeographyInWorker() {
        workerCalls += 1
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'idle')
    assert.strictEqual(workerCalls, 0)
  } finally {
    scope.stop()
  }
})

test('onBeforeRun and onRunCompleteSuccess hooks fire around a successful run', async () => {
  const scope = effectScope(true)
  try {
    const hookLog = []
    const wrapped = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: () => {},
        onBeforeRun: () => hookLog.push('before'),
        onRunCompleteSuccess: () => hookLog.push('success'),
        runDerivedGeographyInWorker(_params, callbacks) {
          callbacks.onComplete?.()
          return { cancel() {} }
        },
      }),
    )

    wrapped.regenerate()
    await nextTick()

    assert.deepStrictEqual(hookLog, ['before', 'success'])
  } finally {
    scope.stop()
  }
})

test('superseding regenerate ignores stale terminal callbacks from prior run', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}

    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        if (Object.keys(firstRunCallbacks).length === 0) {
          firstRunCallbacks = callbacks
          return { cancel() {} }
        }
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    ctx.regenerate()
    await nextTick()

    firstRunCallbacks.onComplete?.()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(ctx.isGenerating.value, true)
  } finally {
    scope.stop()
  }
})
