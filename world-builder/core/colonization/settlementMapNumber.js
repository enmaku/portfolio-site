/**
 * Author-facing **settlement map number**: stable 1…N ordinal for campaign kit maps
 * and the kit-only Settlement IDs layer. Distinct from the opaque internal settlement `id`.
 */

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isValidSettlementMapNumber(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1
}

/**
 * Next unused map number given existing settlements (includes ruins so numbers are never reused).
 *
 * @param {ReadonlyArray<{ mapNumber?: unknown }> | null | undefined} settlements
 * @returns {number}
 */
export function allocateNextSettlementMapNumber(settlements) {
  let max = 0
  for (const settlement of settlements ?? []) {
    if (isValidSettlementMapNumber(settlement.mapNumber) && settlement.mapNumber > max) {
      max = settlement.mapNumber
    }
  }
  return max + 1
}

/**
 * @param {{ mapNumber?: unknown, foundedEpoch?: unknown, id?: unknown }} settlement
 * @returns {{ foundedEpoch: number, id: string }}
 */
function backfillSortKey(settlement) {
  return {
    foundedEpoch: Number.isFinite(settlement.foundedEpoch)
      ? /** @type {number} */ (settlement.foundedEpoch)
      : 0,
    id: typeof settlement.id === 'string' ? settlement.id : '',
  }
}

/**
 * Ensure every settlement has a stable mapNumber. Existing valid numbers are kept;
 * missing ones are filled in founding order starting after the current max.
 *
 * @template {{ mapNumber?: unknown, foundedEpoch?: unknown, id?: unknown }} T
 * @param {ReadonlyArray<T> | null | undefined} settlements
 * @returns {T[]}
 */
export function ensureSettlementMapNumbers(settlements) {
  const list = (settlements ?? []).map((row) => ({ ...row }))
  let next = allocateNextSettlementMapNumber(list)

  const missing = list
    .map((settlement, index) => ({ settlement, index }))
    .filter(({ settlement }) => !isValidSettlementMapNumber(settlement.mapNumber))
    .sort((a, b) => {
      const keyA = backfillSortKey(a.settlement)
      const keyB = backfillSortKey(b.settlement)
      if (keyA.foundedEpoch !== keyB.foundedEpoch) {
        return keyA.foundedEpoch - keyB.foundedEpoch
      }
      if (keyA.id < keyB.id) return -1
      if (keyA.id > keyB.id) return 1
      return a.index - b.index
    })

  for (const { settlement } of missing) {
    settlement.mapNumber = next
    next += 1
  }

  return list
}
