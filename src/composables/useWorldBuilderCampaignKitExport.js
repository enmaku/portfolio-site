import { computed, ref } from 'vue'
import { assembleCampaignKitPdf, downloadBlob } from '../../world-builder/core/campaignKit/assembleCampaignKitPdf.js'
import { buildCampaignKitModel } from '../../world-builder/core/campaignKit/buildCampaignKitModel.js'
import { campaignKitFilename } from '../../world-builder/core/campaignKit/campaignKitFilename.js'
import {
  campaignKitExportPercent,
  CAMPAIGN_KIT_EXPORT_STEPS,
  createCampaignKitExportStepStatuses,
} from '../../world-builder/core/campaignKit/campaignKitExportProgress.js'
import {
  campaignKitResourcesMapVisibility,
  campaignKitSettlementsMapVisibility,
} from '../../world-builder/core/campaignKit/campaignKitOverlayPresets.js'
import { buildCampaignKitExportStatusSection } from '../../world-builder/buildWorldBuilderStatusBar.js'
import { yieldColonizationProgressToUi } from './colonizationUiYield.js'

/**
 * @param {{
 *   getViewport: () => {
 *     syncOverlayRenderCache?: (state: import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState) => void,
 *     setSettlementIdLabelsVisible?: (visible: boolean) => void,
 *     captureWorldPng?: () => Promise<Blob>,
 *   } | null,
 *   getOverlayDisplaySettings: () => import('../../world-builder/resourceOverlays.js').OverlayDisplaySettings,
 *   syncOverlayToViewport: () => void,
 *   getSlice: () => import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   getWorldDocument: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   canExport: () => boolean,
 *   isOtherWorkBusy: () => boolean,
 * }} options
 */
export function useWorldBuilderCampaignKitExport(options) {
  const exportPhase = ref(/** @type {'idle' | 'running'} */ ('idle'))
  const activeStepIndex = ref(-1)
  const completedStepIndex = ref(-1)

  const isCampaignKitExportRunning = computed(() => exportPhase.value === 'running')

  const statusSection = computed(() => {
    if (!isCampaignKitExportRunning.value) {
      return null
    }
    return buildCampaignKitExportStatusSection({
      percent: campaignKitExportPercent(activeStepIndex.value, completedStepIndex.value),
      steps: createCampaignKitExportStepStatuses(activeStepIndex.value, completedStepIndex.value),
    })
  })

  /**
   * @param {number} stepIndex
   */
  async function enterStep(stepIndex) {
    activeStepIndex.value = stepIndex
    await yieldColonizationProgressToUi()
  }

  async function completeActiveStep() {
    if (activeStepIndex.value >= 0) {
      completedStepIndex.value = activeStepIndex.value
    }
    activeStepIndex.value = -1
    await yieldColonizationProgressToUi()
  }

  /**
   * @param {Record<string, boolean>} visibility
   * @param {boolean} settlementIdLabels
   */
  function applyKitOverlays(visibility, settlementIdLabels) {
    const viewport = options.getViewport()
    viewport?.syncOverlayRenderCache?.({
      visibility,
      displaySettings: { ...options.getOverlayDisplaySettings() },
    })
    viewport?.setSettlementIdLabelsVisible?.(settlementIdLabels)
  }

  async function exportCampaignKit() {
    if (!options.canExport() || options.isOtherWorkBusy() || isCampaignKitExportRunning.value) {
      return false
    }
    const viewport = options.getViewport()
    const worldDocument = options.getWorldDocument()
    if (!viewport?.captureWorldPng || !worldDocument) {
      return false
    }

    exportPhase.value = 'running'
    activeStepIndex.value = -1
    completedStepIndex.value = -1

    try {
      await enterStep(0)

      await completeActiveStep()
      await enterStep(1)
      applyKitOverlays(campaignKitSettlementsMapVisibility(), true)
      await yieldColonizationProgressToUi()
      const settlementsMapPng = await viewport.captureWorldPng()

      await completeActiveStep()
      await enterStep(2)
      applyKitOverlays(campaignKitResourcesMapVisibility(), false)
      await yieldColonizationProgressToUi()
      const resourcesMapPng = await viewport.captureWorldPng()

      await completeActiveStep()
      await enterStep(3)
      const slice = options.getSlice()
      const model = buildCampaignKitModel(slice, worldDocument)
      const pdf = await assembleCampaignKitPdf({
        model,
        settlementsMapPng,
        resourcesMapPng,
      })
      downloadBlob(
        pdf,
        campaignKitFilename({
          geographySeed: model.header.geographySeed,
          epoch: model.header.epoch,
        }),
      )
      await completeActiveStep()
      return true
    } finally {
      try {
        options.getViewport()?.setSettlementIdLabelsVisible?.(false)
        options.syncOverlayToViewport()
      } catch {
        // restore best-effort
      }
      exportPhase.value = 'idle'
      activeStepIndex.value = -1
      completedStepIndex.value = -1
    }
  }

  return {
    isCampaignKitExportRunning,
    statusSection,
    exportCampaignKit,
    stepCount: CAMPAIGN_KIT_EXPORT_STEPS.length,
  }
}
