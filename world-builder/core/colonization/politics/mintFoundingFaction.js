/**
 * Mint the founding faction for the colonial landing settlement.
 * Domain: world-builder/CONTEXT.md — Faction, Realm.
 */

import { HISTORY_KIND_FACTION_EMERGED } from './historyKinds.js'

/**
 * @param {{
 *   settlement: object,
 *   epoch?: number,
 * }} params
 * @returns {{
 *   settlement: object,
 *   faction: import('../createDefaultColonizationSlice.js').FactionRecord,
 *   historyEntry: object,
 * }}
 */
export function mintFoundingFaction(params) {
  const epoch = Number.isFinite(params.epoch) ? /** @type {number} */ (params.epoch) : 0
  const settlement = params.settlement
  const factionId = `faction-founding-${settlement.id}`
  const faction = {
    id: factionId,
    capitalSettlementId: settlement.id,
    settlementIds: [settlement.id],
    status: /** @type {const} */ ('active'),
    emergedEpoch: epoch,
  }
  const historyEntry = {
    kind: HISTORY_KIND_FACTION_EMERGED,
    epoch,
    factionId,
    capitalSettlementId: settlement.id,
    cause: 'founding',
  }
  return {
    settlement: {
      ...settlement,
      factionId,
      vassalLiegeSettlementId: null,
    },
    faction,
    historyEntry,
  }
}
