/** Fixed daughter outpost headcount at automatic founding. */
export const DAUGHTER_OUTPOST_HEADCOUNT = 25

/** Base dispatch probability per idle living settlement per epoch. */
export const EXPEDITION_DISPATCH_BASE_PROBABILITY = 0.55

/** Dispatch probability multiplier when frontier is exhausted. */
export const FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER = 0.15

/** Local disc radius when clearing visit status at a reached logistics node. */
export const LOGISTICS_NODE_VISIT_DISC_RADIUS = 1

/** Scale for per-settlement concurrent expedition cap: max(1, floor(this / living settlements)). */
export const EXPEDITION_CONCURRENCY_SETTLEMENT_SCALE = 80

/**
 * @typedef {Object} ExpeditionRecord
 * @property {string} id
 * @property {string} settlementId
 * @property {'land' | 'inland_sail' | 'open_sea'} mode
 * @property {number} bearing Fixed radians at dispatch.
 * @property {Array<{ x: number, y: number }>} route
 * @property {number} progressIndex
 * @property {'active' | 'completed'} status
 * @property {import('./bearingStepUtils.js').ExpeditionEndReason} [endReason]
 */

/** @typedef {'land' | 'inland_sail' | 'open_sea'} ExpeditionMode */

/**
 * @param {unknown} mode
 * @returns {ExpeditionMode}
 */
export function resolveExpeditionMode(mode) {
  if (mode === 'open_sea') return 'open_sea'
  if (mode === 'inland_sail' || mode === 'sail') return 'inland_sail'
  return 'land'
}

/**
 * @param {ExpeditionMode} mode
 * @returns {boolean}
 */
export function isMaritimeExpeditionMode(mode) {
  return mode === 'inland_sail' || mode === 'open_sea'
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {ExpeditionRecord[]}
 */
export function getActiveExpeditions(slice) {
  return (slice.expeditions ?? []).filter((expedition) => expedition.status === 'active')
}

/**
 * @param {number} livingSettlementCount
 * @returns {number}
 */
export function computeMaxActiveExpeditionsPerSettlement(livingSettlementCount) {
  const livingCount = Math.max(1, livingSettlementCount)
  return Math.max(
    1,
    Math.floor(EXPEDITION_CONCURRENCY_SETTLEMENT_SCALE / livingCount),
  )
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {string} settlementId
 * @returns {number}
 */
export function countActiveExpeditionsForSettlement(slice, settlementId) {
  return getActiveExpeditions(slice).filter(
    (expedition) => expedition.settlementId === settlementId,
  ).length
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
      mode: resolveExpeditionMode(record.mode),
      bearing: Number.isFinite(record.bearing) ? record.bearing : 0,
      route: Array.isArray(record.route)
        ? record.route
            .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
            .map((cell) => ({ x: cell.x, y: cell.y }))
        : [],
      progressIndex: Number.isFinite(record.progressIndex) ? record.progressIndex : 0,
      status: record.status === 'completed' ? 'completed' : 'active',
      endReason:
        record.endReason === 'blocked' ||
        record.endReason === 'range_cap' ||
        record.endReason === 'survey_complete' ||
        record.endReason === 'founded'
          ? record.endReason
          : undefined,
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
