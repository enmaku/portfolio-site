import { useWorldBuilderCampaignKitExport } from './useWorldBuilderCampaignKitExport.js'
import { useWorldBuilderLlmSettlementNames } from './useWorldBuilderLlmSettlementNames.js'

/**
 * @param {{
 *   getViewport: () => object | null,
 *   getOverlayDisplaySettings: () => import('../../world-builder/resourceOverlays.js').OverlayDisplaySettings,
 *   syncOverlayToViewport: () => void,
 *   getSlice: () => import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   getWorldDocument: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   timeControlsActive: () => boolean,
 *   isEpochStepRunning: () => boolean,
 *   isBeginColonizationRunning: () => boolean,
 *   isRehydrationRunning: () => boolean,
 *   isSessionRestorePending: () => boolean,
 * }} options
 */
export function useWorldBuilderCampaignKitAndLlmNames(options) {
  function isBaseBusy() {
    return (
      options.isEpochStepRunning() ||
      options.isBeginColonizationRunning() ||
      options.isRehydrationRunning() ||
      options.isSessionRestorePending()
    )
  }

  const campaignKit = useWorldBuilderCampaignKitExport({
    getViewport: options.getViewport,
    getOverlayDisplaySettings: options.getOverlayDisplaySettings,
    syncOverlayToViewport: options.syncOverlayToViewport,
    getSlice: options.getSlice,
    getWorldDocument: options.getWorldDocument,
    canExport: () => options.timeControlsActive(),
    isOtherWorkBusy: isBaseBusy,
  })

  const llmSettlementNames = useWorldBuilderLlmSettlementNames({
    getSlice: options.getSlice,
    getWorldDocument: options.getWorldDocument,
    getViewport: options.getViewport,
    canGenerate: () => options.timeControlsActive(),
    isOtherWorkBusy: () => isBaseBusy() || campaignKit.isCampaignKitExportRunning.value,
  })

  return { campaignKit, llmSettlementNames }
}
