/**
 * Taxed members contribute allied projected might; trade partners do not.
 * Domain: world-builder/CONTEXT.md — Projected might; Trade partner.
 */

/**
 * @param {object | null | undefined} settlement
 * @returns {boolean}
 */
export function isTaxedFactionMember(settlement) {
  if (!settlement) return false
  if (settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  if (!settlement.factionId) return false
  if (settlement.isTradePartner === true) return false
  return true
}

/**
 * @param {{
 *   factionId: string,
 *   settlements?: Array<object> | null,
 *   settlementIds?: string[] | null,
 *   excludeSettlementId?: string | null,
 * }} params
 * @returns {string[]}
 */
export function taxedMemberSettlementIds(params) {
  const settlements = Array.isArray(params.settlements) ? params.settlements : []
  const byId = new Map(settlements.map((s) => [s.id, s]))
  const ids = Array.isArray(params.settlementIds)
    ? params.settlementIds
    : settlements.filter((s) => s.factionId === params.factionId).map((s) => s.id)

  /** @type {string[]} */
  const out = []
  for (const id of ids) {
    if (params.excludeSettlementId && id === params.excludeSettlementId) continue
    const settlement = byId.get(id)
    if (!settlement) continue
    if (settlement.factionId !== params.factionId) continue
    if (!isTaxedFactionMember(settlement)) continue
    out.push(id)
  }
  return out
}
