import { computed, ref, watch } from 'vue'
import { generateSettlementNamesWithGemini } from '../features/world-builder/llm/generateSettlementNames.js'
import { canvasToJpegBlob } from '../features/world-builder/llm/mapImageForGemini.js'
import { collectWriteupMentionedSettlementIds } from '../../world-builder/llm/collectWriteupMentionedSettlementIds.js'
import {
  catalogHasResettableNames,
  compactNameMap,
  normalizeCatalogName,
} from '../../world-builder/llm/settlementNameCatalog.js'
import {
  buildLlmPhysicalMapCanvas,
  buildLlmPoliticalMapCanvas,
  mergeWorldDocumentForLlmMaps,
} from '../../world-builder/llm/buildLlmContextMapCanvas.js'

/**
 * Spike UI: flavor prompt + Gemini settlement/faction names + region writeup + map overlay.
 *
 * @param {{
 *   getSlice: () => import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   getWorldDocument: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   getViewport: () => {
 *     setCustomSettlementNames?: (namesById: Record<string, string>) => void,
 *     setCustomFactionNames?: (namesById: Record<string, string>) => void,
 *     setCustomRegionName?: (regionName: string) => void,
 *     setCustomSettlementNamesVisible?: (visible: boolean) => void,
 *     setCustomSettlementNameHighlights?: (settlementIds: Iterable<string>) => void,
 *     onCustomNameEdit?: (handler: ((payload: import('../../world-builder/renderer/attachNameOverlayEditHandler.js').NameOverlayEditTarget) => void) | null) => void,
 *   } | null,
 *   canGenerate: () => boolean,
 *   isOtherWorkBusy: () => boolean,
 *   generateNames?: typeof generateSettlementNamesWithGemini,
 *   buildContextMapJpegs?: (
 *     worldDocument: import('../../world-builder/core/types.js').WorldDocument,
 *     slice: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   ) => Promise<Blob[]>,
 * }} options
 */
export function useWorldBuilderLlmSettlementNames(options) {
  const generateNames = options.generateNames ?? generateSettlementNamesWithGemini
  const flavorPrompt = ref('')
  const namesOverlayVisible = ref(false)
  const namesBySettlementId = ref(/** @type {Record<string, string>} */ ({}))
  const namesByFactionId = ref(/** @type {Record<string, string>} */ ({}))
  const writeupMentionedSettlementIds = ref(/** @type {string[]} */ ([]))
  const regionName = ref('')
  const regionWriteup = ref('')
  const generatePhase = ref(/** @type {'idle' | 'running'} */ ('idle'))
  const lastError = ref(/** @type {string | null} */ (null))
  const nameEditorOpen = ref(false)
  const nameEditorTarget = ref(
    /** @type {import('../../world-builder/renderer/attachNameOverlayEditHandler.js').NameOverlayEditTarget | null} */ (
      null
    ),
  )
  const nameEditorDraft = ref('')

  const isGenerateRunning = computed(() => generatePhase.value === 'running')
  const generateDisabled = computed(
    () =>
      !options.canGenerate() ||
      options.isOtherWorkBusy() ||
      isGenerateRunning.value,
  )
  const canResetNames = computed(() =>
    catalogHasResettableNames(
      {
        settlements: namesBySettlementId.value,
        factions: namesByFactionId.value,
        regionName: regionName.value,
      },
      regionWriteup.value,
    ),
  )
  const resetNamesDisabled = computed(
    () => !canResetNames.value || isGenerateRunning.value || options.isOtherWorkBusy(),
  )

  function currentCatalog() {
    return {
      settlements: namesBySettlementId.value,
      factions: namesByFactionId.value,
      regionName: regionName.value,
    }
  }

  function syncNamesToViewport() {
    const viewport = options.getViewport()
    viewport?.onCustomNameEdit?.(openNameEditor)
    viewport?.setCustomSettlementNames?.(namesBySettlementId.value)
    viewport?.setCustomFactionNames?.(namesByFactionId.value)
    viewport?.setCustomRegionName?.(regionName.value)
    viewport?.setCustomSettlementNameHighlights?.(writeupMentionedSettlementIds.value)
    viewport?.setCustomSettlementNamesVisible?.(namesOverlayVisible.value)
  }

  watch(namesOverlayVisible, () => {
    syncNamesToViewport()
  })

  /**
   * Offscreen physical (+ optional political) JPEGs for Gemini.
   *
   * @param {import('../../world-builder/core/types.js').WorldDocument} worldDocument
   * @param {import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
   * @returns {Promise<Blob[]>}
   */
  async function buildContextMapJpegs(worldDocument, slice) {
    const merged = mergeWorldDocumentForLlmMaps(worldDocument, slice)
    /** @type {Blob[]} */
    const images = []
    const physical = buildLlmPhysicalMapCanvas(merged, {
      roads: slice.roads,
      settlements: slice.settlements,
    })
    images.push(await canvasToJpegBlob(physical))

    const political = buildLlmPoliticalMapCanvas(merged, {
      roads: slice.roads,
      settlements: slice.settlements,
    })
    if (political) {
      images.push(await canvasToJpegBlob(political))
    }
    return images
  }

  /**
   * @param {import('../../world-builder/renderer/attachNameOverlayEditHandler.js').NameOverlayEditTarget} target
   * @returns {string}
   */
  function nameForTarget(target) {
    if (target.kind === 'realm') return regionName.value
    if (target.kind === 'settlement' && target.id) {
      return namesBySettlementId.value[target.id] ?? ''
    }
    if (target.kind === 'faction' && target.id) {
      return namesByFactionId.value[target.id] ?? ''
    }
    return ''
  }

  /**
   * @param {import('../../world-builder/renderer/attachNameOverlayEditHandler.js').NameOverlayEditTarget | null} target
   * @param {string} raw
   */
  function applyName(target, raw) {
    if (!target) return
    const name = normalizeCatalogName(raw)
    if (target.kind === 'realm') {
      regionName.value = name
    } else if (target.kind === 'settlement' && target.id) {
      const next = { ...namesBySettlementId.value }
      if (name) next[target.id] = name
      else delete next[target.id]
      namesBySettlementId.value = next
    } else if (target.kind === 'faction' && target.id) {
      const next = { ...namesByFactionId.value }
      if (name) next[target.id] = name
      else delete next[target.id]
      namesByFactionId.value = next
    }
    syncNamesToViewport()
  }

  /**
   * @param {import('../../world-builder/renderer/attachNameOverlayEditHandler.js').NameOverlayEditTarget} target
   */
  function openNameEditor(target) {
    if (!target) return
    if (target.kind !== 'realm' && typeof target.id !== 'string') return
    nameEditorTarget.value = { kind: target.kind, id: target.id }
    nameEditorDraft.value = nameForTarget(target)
    nameEditorOpen.value = true
    if (!namesOverlayVisible.value) {
      namesOverlayVisible.value = true
    }
  }

  function closeNameEditor() {
    nameEditorOpen.value = false
    nameEditorTarget.value = null
    nameEditorDraft.value = ''
  }

  /**
   * @param {boolean} open
   */
  function setNameEditorOpen(open) {
    if (open === true) {
      nameEditorOpen.value = true
      return
    }
    closeNameEditor()
  }

  function saveNameEditor() {
    applyName(nameEditorTarget.value, nameEditorDraft.value)
    closeNameEditor()
  }

  function clearNameEditor() {
    applyName(nameEditorTarget.value, '')
    closeNameEditor()
  }

  function resetAllNames() {
    namesBySettlementId.value = {}
    namesByFactionId.value = {}
    regionName.value = ''
    regionWriteup.value = ''
    writeupMentionedSettlementIds.value = []
    closeNameEditor()
    syncNamesToViewport()
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
      const mapImages = await (options.buildContextMapJpegs ?? buildContextMapJpegs)(
        worldDocument,
        slice,
      )
      const result = await generateNames({
        slice,
        worldDocument,
        flavorPrompt: flavorPrompt.value,
        mapImages,
        catalog: currentCatalog(),
      })
      namesBySettlementId.value = compactNameMap(result.settlements)
      namesByFactionId.value = compactNameMap(result.factions)
      regionName.value = normalizeCatalogName(result.regionName)
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

  /**
   * @param {string} value
   */
  function setFlavorPrompt(value) {
    flavorPrompt.value = typeof value === 'string' ? value : ''
  }

  /**
   * @param {string} value
   */
  function setNameEditorDraft(value) {
    nameEditorDraft.value = typeof value === 'string' ? value : ''
  }

  function setNamesOverlayVisible(visible) {
    namesOverlayVisible.value = visible === true
  }

  return {
    flavorPrompt,
    namesOverlayVisible,
    namesBySettlementId,
    namesByFactionId,
    regionName,
    regionWriteup,
    isGenerateRunning,
    generateDisabled,
    canResetNames,
    resetNamesDisabled,
    lastError,
    nameEditorOpen,
    nameEditorTarget,
    nameEditorDraft,
    generateSettlementNames,
    setFlavorPrompt,
    setNameEditorDraft,
    setNamesOverlayVisible,
    syncNamesToViewport,
    openNameEditor,
    closeNameEditor,
    setNameEditorOpen,
    saveNameEditor,
    clearNameEditor,
    resetAllNames,
  }
}
