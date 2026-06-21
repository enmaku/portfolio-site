import { derivePrevailingWindFromSeed } from './core/derivePrevailingWindFromSeed.js'

/**
 * @returns {number}
 */
export function createRandomGeographySeed() {
  return (Math.random() * 4294967296) | 0
}

/**
 * @param {number} geographySeed
 * @returns {{ geographySeed: number, prevailingWindDegrees: number }}
 */
export function createControlsStateForSeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return {
    geographySeed: normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296,
    prevailingWindDegrees: derivePrevailingWindFromSeed(normalizedSeed),
  }
}

/**
 * @param {number | string} rawSeed
 * @returns {number | null}
 */
export function parseGeographySeedInput(rawSeed) {
  const parsed = Number.parseInt(String(rawSeed), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed | 0
}

/**
 * @param {number} degrees
 * @returns {number}
 */
export function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}

/**
 * @param {'pass' | 'warn'} status
 * @returns {string}
 */
export function validationStatusColor(status) {
  return status === 'pass' ? 'positive' : 'warning'
}

/**
 * @param {'pass' | 'warn'} status
 * @returns {string}
 */
export function validationStatusIcon(status) {
  return status === 'pass' ? 'check_circle' : 'warning'
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 * @returns {Array<{ checkId: string, status: 'pass' | 'warn', summary: string, mapFocus?: import('./core/types.js').MapFocus }>}
 */
export function createValidationRowsForDisplay(report) {
  if (!report) return []
  return report.validationRows
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 * @returns {{ erosionStepCount: number, navigableRiverEdgeCount: number, coastalNodeCount: number }}
 */
export function createStageSummaryForDisplay(report) {
  return {
    erosionStepCount: report?.erosionStepCount ?? 0,
    navigableRiverEdgeCount: report?.navigableRiverEdgeCount ?? 0,
    coastalNodeCount: report?.coastalNodeCount ?? 0,
  }
}

/**
 * @param {number} stepIndex
 * @param {number} stepCount
 * @returns {number}
 */
export function generationProgressValue(stepIndex, stepCount) {
  if (stepCount <= 0) return 0
  return Math.round(((stepIndex + 1) / stepCount) * 100)
}

/**
 * @param {ReadonlyArray<{ id: string, label: string }>} steps
 * @param {number} activeStepIndex
 * @param {number} completedStepIndex
 * @returns {Array<{ id: string, label: string, status: 'pending' | 'active' | 'complete' }>}
 */
export function createGenerationStepStatuses(steps, activeStepIndex, completedStepIndex) {
  return steps.map((step, index) => {
    if (index <= completedStepIndex) {
      return { ...step, status: 'complete' }
    }
    if (index === activeStepIndex) {
      return { ...step, status: 'active' }
    }
    return { ...step, status: 'pending' }
  })
}
