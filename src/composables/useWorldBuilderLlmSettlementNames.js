import { computed, ref, watch } from 'vue'
import { generateSettlementNamesWithGemini } from '../features/world-builder/llm/generateSettlementNames.js'
import { canvasToJpegBlob } from '../features/world-builder/llm/mapImageForGemini.js'
import { collectWriteupMentionedSettlementIds } from '../../world-builder/llm/collectWriteupMentionedSettlementIds.js'
import { buildLlmContextMapCanvas } from '../../world-builder/llm/buildLlmContextMapCanvas.js'

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
 *     setCustomSettlementNameHighlights?: (settlementIds: Iterable<string>) => void,
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
  const writeupMentionedSettlementIds = ref(/** @type {string[]} */ ([]))
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
    viewport?.setCustomSettlementNameHighlights?.(writeupMentionedSettlementIds.value)
    viewport?.setCustomSettlementNamesVisible?.(namesOverlayVisible.value)
  }

  watch(namesOverlayVisible, () => {
    syncNamesToViewport()
  })

  /**
   * Offscreen terrain + routes + settlement pins for Gemini (no live viewport mutation).
   *
   * @param {import('../../world-builder/core/types.js').WorldDocument} worldDocument
   * @param {import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
   * @returns {Promise<Blob>}
   */
  async function buildContextMapJpeg(worldDocument, slice) {
    const canvas = buildLlmContextMapCanvas(worldDocument, {
      roads: slice.roads,
      settlements: slice.settlements,
    })
    return canvasToJpegBlob(canvas)
  }

  async function generateSettlementNames() {
    if (generateDisabled.value) return

    lastError.value = null
    generatePhase.value = 'running'
    try {
      const worldDocument = options.getWorldDocument()
      if (!worldDocument) {
        throw new Error('No world document loaded')
      }
      const slice = options.getSlice()
      const mapImage = await buildContextMapJpeg(worldDocument, slice)
      const result = await generateSettlementNamesWithGemini({
        slice,
        worldDocument,
        flavorPrompt: flavorPrompt.value,
        mapImage,
      })
      namesBySettlementId.value = result.settlements
      namesByFactionId.value = result.factions
      regionWriteup.value = result.regionWriteup
      writeupMentionedSettlementIds.value = collectWriteupMentionedSettlementIds(result)
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
