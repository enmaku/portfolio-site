import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { createInitialGenerationProgress } from './worldBuilderGenerationOrchestrator.js'
import { useWorldBuilderGeneration } from '../src/composables/useWorldBuilderGeneration.js'

/** @type {import('./core/types.js').DerivedGeographyParams} */
const SAMPLE_PARAMS = { geographySeed: 1, prevailingWindDegrees: 90, options: {} }

/**
 * Mirrors worker-bridge cancel → onCancelled delivery after slice #339.
 *
 * @param {import('./worldBuilderGenerationOrchestrator.js').DerivedGeographyWorkerCallbacks} callbacks
 */
function cancelWorkerJob(callbacks) {
  callbacks.onCancelled?.()
}

/**
 * @param {import('vue').EffectScope} scope
 * @param {{
 *   runDerivedGeographyInWorker?: (
 *     params: import('./core/types.js').DerivedGeographyParams,
 *     callbacks: import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks,
 *   ) => { cancel: () => void },
 * }} [overrides]
 */
function mountGeneration(scope, overrides = {}) {
  return scope.run(() =>
    useWorldBuilderGeneration({
      getDerivedGeographyParams: () => SAMPLE_PARAMS,
      applyWorldDocument: () => {},
      runDerivedGeographyInWorker: overrides.runDerivedGeographyInWorker,
    }),
  )
}

test('unmount via dispose leaves run phase cancelled', async () => {
  const scope = effectScope(true)
  try {
    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        callbacks.onStepStart?.({
          stepId: 'baseline',
          stepIndex: 2,
          stepCount: 6,
          label: 'Baseline',
        })
        return {
          cancel() {
            cancelWorkerJob(callbacks)
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

test('supersede via regenerate stays running and clears stale progress callbacks', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}
    let firstJobCancelCount = 0

    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        if (Object.keys(firstRunCallbacks).length === 0) {
          firstRunCallbacks = callbacks
          return {
            cancel() {
              firstJobCancelCount += 1
              cancelWorkerJob(callbacks)
            },
          }
        }
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    ctx.regenerate()
    await nextTick()

    assert.strictEqual(firstJobCancelCount, 1)
    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(ctx.isGenerating.value, true)

    firstRunCallbacks.onStepStart?.({
      stepId: 'baseline',
      stepIndex: 0,
      stepCount: 6,
      label: 'Baseline',
    })

    assert.strictEqual(ctx.generationProgress.value.activeStepIndex, -1)

    firstRunCallbacks.onCancelled?.()
    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(ctx.isGenerating.value, true)
  } finally {
    scope.stop()
  }
})

test('supersede ignores stale onComplete from superseded run', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}

    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        if (Object.keys(firstRunCallbacks).length === 0) {
          firstRunCallbacks = callbacks
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

test('dispose delivers onCancelled once when worker bridge dedups cancel and ack', async () => {
  const scope = effectScope(true)
  try {
    let cancelledCount = 0

    const ctx = mountGeneration(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        let settled = false
        /** @returns {void} */
        function handleCancelled() {
          if (settled) {
            return
          }
          settled = true
          cancelledCount += 1
          callbacks.onCancelled?.()
        }
        return {
          cancel() {
            handleCancelled()
            handleCancelled()
          },
        }
      },
    })

    ctx.regenerate()
    await nextTick()
    ctx.dispose()
    await nextTick()

    assert.strictEqual(cancelledCount, 1)
    assert.strictEqual(ctx.runPhase.value, 'cancelled')
    assert.strictEqual(ctx.isGenerating.value, false)
  } finally {
    scope.stop()
  }
})
