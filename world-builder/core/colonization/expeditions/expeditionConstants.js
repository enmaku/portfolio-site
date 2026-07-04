/** Fixed daughter outpost headcount at automatic founding. */
export const DAUGHTER_OUTPOST_HEADCOUNT = 25

/** Base dispatch probability per idle living settlement per epoch. */
export const EXPEDITION_DISPATCH_BASE_PROBABILITY = 0.55

/** Dispatch probability multiplier when frontier is exhausted. */
export const FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER = 0.15

/** Local disc radius when clearing visit status at a reached logistics node. */
export const LOGISTICS_NODE_VISIT_DISC_RADIUS = 1

/**
 * @typedef {Object} ExpeditionRecord
 * @property {string} id
 * @property {string} settlementId
 * @property {'land' | 'sail'} mode
 * @property {Array<{ x: number, y: number }>} route
 * @property {number} progressIndex
 * @property {{ x: number, y: number }} target
 * @property {'active' | 'completed'} status
 */

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {ExpeditionRecord[]}
 */
export function getActiveExpeditions(slice) {
  return (slice.expeditions ?? []).filter((expedition) => expedition.status === 'active')
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {string} settlementId
 * @returns {ExpeditionRecord | undefined}
 */
export function getActiveExpeditionForSettlement(slice, settlementId) {
  return getActiveExpeditions(slice).find((expedition) => expedition.settlementId === settlementId)
}

/**
 * @param {unknown} value
 * @returns {ExpeditionRecord[]}
 */
export function resolveExpeditions(value) {
  if (!Array.isArray(value)) return []
  /** @type {ExpeditionRecord[]} */
  const resolved = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = /** @type {ExpeditionRecord} */ (entry)
    if (typeof record.id !== 'string' || typeof record.settlementId !== 'string') continue
    resolved.push({
      id: record.id,
      settlementId: record.settlementId,
      mode: record.mode === 'sail' ? 'sail' : 'land',
      route: Array.isArray(record.route)
        ? record.route
            .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
            .map((cell) => ({ x: cell.x, y: cell.y }))
        : [],
      progressIndex: Number.isFinite(record.progressIndex) ? record.progressIndex : 0,
      target:
        record.target && Number.isFinite(record.target.x) && Number.isFinite(record.target.y)
          ? { x: record.target.x, y: record.target.y }
          : { x: 0, y: 0 },
      status: record.status === 'completed' ? 'completed' : 'active',
    })
  }
  return resolved
}

/**
 * @param {object[]} settlements
 * @returns {object[]}
 */
export function livingSettlements(settlements) {
  return settlements.filter((settlement) => settlement.status !== 'ruin')
}

/**
 * @param {object[]} settlements
 * @returns {number}
 */
export function countLivingSettlements(settlements) {
  return livingSettlements(settlements).length
}
