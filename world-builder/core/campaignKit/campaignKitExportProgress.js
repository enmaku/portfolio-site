/**
 * Campaign kit export progress step ids and status builders.
 */

/** @type {ReadonlyArray<{ id: string, label: string }>} */
export const CAMPAIGN_KIT_EXPORT_STEPS = Object.freeze([
  { id: 'prepare', label: 'Prepare' },
  { id: 'settlementsMap', label: 'Settlements map' },
  { id: 'resourcesMap', label: 'Resources map' },
  { id: 'model', label: 'Build kit model' },
  { id: 'pdf', label: 'Assemble PDF' },
])

/**
 * @param {number} activeStepIndex 0-based index of the running step; -1 when idle/complete
 * @param {number} completedStepIndex last fully completed 0-based index; -1 when none
 * @returns {Array<{ id: string, label: string, status: string }>}
 */
export function createCampaignKitExportStepStatuses(activeStepIndex, completedStepIndex) {
  return CAMPAIGN_KIT_EXPORT_STEPS.map((step, index) => {
    let status = 'pending'
    if (index <= completedStepIndex) {
      status = 'done'
    } else if (index === activeStepIndex) {
      status = 'active'
    }
    return { id: step.id, label: step.label, status }
  })
}

/**
 * @param {number} activeStepIndex
 * @param {number} completedStepIndex
 * @returns {number}
 */
export function campaignKitExportPercent(activeStepIndex, completedStepIndex) {
  const total = CAMPAIGN_KIT_EXPORT_STEPS.length
  if (total === 0) {
    return 0
  }
  const completed = Math.max(0, completedStepIndex + 1)
  if (activeStepIndex < 0) {
    return Math.round((completed / total) * 100)
  }
  return Math.min(99, Math.round(((completed + 0.5) / total) * 100))
}
