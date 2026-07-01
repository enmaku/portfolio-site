import { computed, ref, shallowRef } from 'vue'
import { runDerivedGeographyInWorker } from '../../world-builder/runDerivedGeographyInWorker.js'
import {
  createGenerationRunController,
  createInitialGenerationProgress,
  startDerivedGeographyGeneration,
} from '../../world-builder/worldBuilderGenerationOrchestrator.js'
import {
  shouldShowGenerationProgress,
  shouldShowResourceOverlayBar,
  shouldShowValidationFailureIndicator,
} from '../../world-builder/worldBuilderPageModel.js'

/** @typedef {import('../../world-builder/worldBuilderPageModel.js').GenerationRunPhase} GenerationRunPhase */

/**
 * @param {{
 *   getDerivedGeographyParams: () => import('../../world-builder/core/types.js').DerivedGeographyParams | null,
 *   applyWorldDocument: (doc: import('../../world-builder/core/types.js').WorldDocument) => void | Promise<void>,
 *   onRunError?: (message: string) => void,
 *   onBeforeRun?: () => void,
 *   onRunCompleteSuccess?: () => void,
 *   runDerivedGeographyInWorker?: typeof runDerivedGeographyInWorker,
 * }} options
 */
export function useWorldBuilderGeneration(options) {
  /** @type {import('vue').Ref<GenerationRunPhase>} */
  const runPhase = ref('idle')
  /** @type {import('vue').ShallowRef<import('../../world-builder/core/types.js').WorldDocument | null>} */
  const worldDocument = shallowRef(null)
  const generationProgress = ref(createInitialGenerationProgress())
  /** @type {import('vue').ShallowRef<ReturnType<typeof createGenerationRunController> | null>} */
  const generationRunController = shallowRef(null)

  const isGenerating = computed(() => runPhase.value === 'running')
  const showGenerationProgress = computed(() => shouldShowGenerationProgress(runPhase.value))
  const showResourceOverlayBar = computed(() => shouldShowResourceOverlayBar(runPhase.value))
  const showValidationFailureIndicator = computed(() =>
    shouldShowValidationFailureIndicator(runPhase.value),
  )

  const runWorker = options.runDerivedGeographyInWorker ?? runDerivedGeographyInWorker

  function ensureController() {
    if (!generationRunController.value) {
      generationRunController.value = createGenerationRunController()
    }
    return generationRunController.value
  }

  /**
   * @param {unknown} error
   */
  function handleGenerationError(error) {
    generationRunController.value?.invalidateRuns()
    runPhase.value = 'error'
    const message = error instanceof Error ? error.message : String(error)
    options.onRunError?.(message)
  }

  function regenerate() {
    const params = options.getDerivedGeographyParams()
    if (params === null) {
      return
    }

    const controller = ensureController()
    options.onBeforeRun?.()
    runPhase.value = 'running'
    generationProgress.value = createInitialGenerationProgress()

    startDerivedGeographyGeneration({
      controller,
      params,
      runDerivedGeographyInWorker: runWorker,
      handlers: {
        onRunStarted({ progress }) {
          generationProgress.value = progress
        },
        onProgress(progress) {
          generationProgress.value = progress
        },
        onWorldDocument(doc) {
          worldDocument.value = doc
          Promise.resolve(options.applyWorldDocument(doc)).catch((error) => {
            handleGenerationError(error)
          })
        },
        onComplete() {
          runPhase.value = 'success'
          options.onRunCompleteSuccess?.()
        },
        onExhausted() {
          runPhase.value = 'exhausted'
        },
        onCancelled() {
          runPhase.value = 'cancelled'
          generationProgress.value = createInitialGenerationProgress()
        },
        onError(message) {
          handleGenerationError(message)
        },
      },
    })
  }

  function dispose() {
    generationRunController.value?.cancelActive()
    generationRunController.value = null
  }

  return {
    runPhase,
    worldDocument,
    generationProgress,
    isGenerating,
    showGenerationProgress,
    showResourceOverlayBar,
    showValidationFailureIndicator,
    regenerate,
    dispose,
  }
}
