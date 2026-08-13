import { computed, ref, watch } from 'vue'
import { generateSettlementNamesWithGemini } from '../features/world-builder/llm/generateSettlementNames.js'

/**
 * Spike UI: flavor prompt + Gemini settlement/faction names + region writeup + map overlay.
 *
 * @param {{
 *   getSlice: () => import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   getWorldDocument: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   getViewport: () => {
 *     setCustomSettlementNames?: (namesById: Record<string, string>) => void,
 *     setCustomFactionNames?: (namesById: Record<string, string>) => void,
 *     setCustomSettlementNamesVisible?: (visible: boolean) => void,
 *   } | null,
 *   canGenerate: () => boolean,
 *   isOtherWorkBusy: () => boolean,
 * }} options
 */
export function useWorldBuilderLlmSettlementNames(options) {
  const flavorPrompt = ref('')
  const namesOverlayVisible = ref(false)
  const namesBySettlementId = ref(/** @type {Record<string, string>} */ ({}))
  const namesByFactionId = ref(/** @type {Record<string, string>} */ ({}))
  const regionWriteup = ref('')
  const generatePhase = ref(/** @type {'idle' | 'running'} */ ('idle'))
  const lastError = ref(/** @type {string | null} */ (null))

  const isGenerateRunning = computed(() => generatePhase.value === 'running')
  const generateDisabled = computed(
    () =>
      !options.canGenerate() ||
      options.isOtherWorkBusy() ||
      isGenerateRunning.value,
  )

  function syncNamesToViewport() {
    const viewport = options.getViewport()
    viewport?.setCustomSettlementNames?.(namesBySettlementId.value)
    viewport?.setCustomFactionNames?.(namesByFactionId.value)
    viewport?.setCustomSettlementNamesVisible?.(namesOverlayVisible.value)
  }

  watch(namesOverlayVisible, () => {
    syncNamesToViewport()
  })

  async function generateSettlementNames() {
    if (generateDisabled.value) return

    lastError.value = null
    generatePhase.value = 'running'
    try {
      const worldDocument = options.getWorldDocument()
      if (!worldDocument) {
        throw new Error('No world document loaded')
      }
      const result = await generateSettlementNamesWithGemini({
        slice: options.getSlice(),
        worldDocument,
        flavorPrompt: flavorPrompt.value,
      })
      namesBySettlementId.value = result.settlements
      namesByFactionId.value = result.factions
      regionWriteup.value = result.regionWriteup
      namesOverlayVisible.value = true
      syncNamesToViewport()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      lastError.value = message
      console.error('Gemini settlement names failed', err)
    } finally {
      generatePhase.value = 'idle'
    }
  }

  function setNamesOverlayVisible(visible) {
    namesOverlayVisible.value = visible === true
  }

  return {
    flavorPrompt,
    namesOverlayVisible,
    namesBySettlementId,
    namesByFactionId,
    regionWriteup,
    isGenerateRunning,
    generateDisabled,
    lastError,
    generateSettlementNames,
    setNamesOverlayVisible,
    syncNamesToViewport,
  }
}
