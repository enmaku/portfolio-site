/**
 * Pick high/low extremes with deterministic settlement-id tie-break.
 * Domain: world-builder/CONTEXT.md — sim status, realm economy.
 */

/**
 * @template {{ id: string }} T
 * @param {T[]} items
 * @param {(item: T) => number} getValue
 * @returns {{ high: T, low: T } | null}
 */
export function pickSettlementExtremes(items, getValue) {
  if (!items.length) {
    return null
  }
  let high = items[0]
  let low = items[0]
  let highValue = getValue(high)
  let lowValue = getValue(low)
  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const value = getValue(item)
    if (value > highValue || (value === highValue && item.id < high.id)) {
      high = item
      highValue = value
    }
    if (value < lowValue || (value === lowValue && item.id < low.id)) {
      low = item
      lowValue = value
    }
  }
  return { high, low }
}
