/** @typedef {import('./expeditionConstants.js').ExpeditionMode} ExpeditionMode */

/** Port open-sea dispatch weight vs land and inland sail (each weight 1). */
export const OPEN_SEA_EXPEDITION_MODE_WEIGHT = 4

/** @type {Record<ExpeditionMode, number>} */
const EXPEDITION_MODE_DISPATCH_WEIGHT = {
  land: 1,
  inland_sail: 1,
  open_sea: OPEN_SEA_EXPEDITION_MODE_WEIGHT,
}

/**
 * @param {import('./evaluateFrontierEligibility.js').FrontierEligibleSender} assignment
 * @returns {ExpeditionMode[]}
 */
export function listAvailableExpeditionModes(assignment) {
  const { canDispatchLand, canDispatchMaritime, maritimeRole } = assignment
  /** @type {ExpeditionMode[]} */
  const modes = []

  if (canDispatchLand) {
    modes.push('land')
  }

  if (canDispatchMaritime && maritimeRole !== 'none') {
    modes.push('inland_sail')
    if (maritimeRole === 'port') {
      modes.push('open_sea')
    }
  }

  return modes
}

/**
 * @param {ExpeditionMode[]} modes
 * @returns {number}
 */
function totalExpeditionModeDispatchWeight(modes) {
  return modes.reduce((sum, mode) => sum + EXPEDITION_MODE_DISPATCH_WEIGHT[mode], 0)
}

/**
 * @param {import('./evaluateFrontierEligibility.js').FrontierEligibleSender} assignment
 * @param {{ (): number }} random
 * @returns {ExpeditionMode}
 */
export function resolveExpeditionModeForSender(assignment, random) {
  const modes = listAvailableExpeditionModes(assignment)
  if (modes.length === 0) {
    return 'land'
  }

  let pick = random() * totalExpeditionModeDispatchWeight(modes)
  for (const mode of modes) {
    pick -= EXPEDITION_MODE_DISPATCH_WEIGHT[mode]
    if (pick <= 0) {
      return mode
    }
  }

  return modes[modes.length - 1]
}
