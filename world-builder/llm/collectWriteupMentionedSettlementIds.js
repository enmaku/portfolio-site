/**
 * Settlement ids the model marked as discussed in the region writeup.
 * Uses structured `writeupSettlementIds` only — never substring matching on prose
 * (faction names like "The X-Y League" must not highlight Y).
 *
 * @param {{
 *   writeupSettlementIds?: string[],
 *   notableSettlements?: Array<{ settlementId?: string }>,
 * }} result
 * @returns {string[]}
 */
export function collectWriteupMentionedSettlementIds(result) {
  /** @type {Set<string>} */
  const ids = new Set()

  for (const id of result.writeupSettlementIds ?? []) {
    if (typeof id === 'string' && id) ids.add(id)
  }

  if (ids.size === 0) {
    for (const row of result.notableSettlements ?? []) {
      if (typeof row?.settlementId === 'string' && row.settlementId) {
        ids.add(row.settlementId)
      }
    }
  }

  return [...ids]
}
