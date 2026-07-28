/**
 * Active-faction roster cap (matches ColorBrewer qualitative set length).
 * Domain: world-builder/CONTEXT.md — Faction territory overlay; Faction.
 */

import { MAX_ACTIVE_FACTIONS } from './politicsConstants.js'

export { MAX_ACTIVE_FACTIONS }

/**
 * @param {Array<{ status?: string }> | null | undefined} factions
 * @returns {number}
 */
export function countActiveFactions(factions) {
  if (!Array.isArray(factions)) return 0
  let count = 0
  for (const faction of factions) {
    if (faction && faction.status === 'active') count += 1
  }
  return count
}

/**
 * @param {Array<{ status?: string }> | null | undefined} factions
 * @returns {boolean}
 */
export function canMintNewFaction(factions) {
  return countActiveFactions(factions) < MAX_ACTIVE_FACTIONS
}

/**
 * Lowest free territory palette slot among active factions (0 … MAX_ACTIVE_FACTIONS-1).
 *
 * @param {Array<{ status?: string, territoryPaletteIndex?: number }> | null | undefined} factions
 * @returns {number | null}
 */
export function allocateTerritoryPaletteIndex(factions) {
  if (!canMintNewFaction(factions)) return null
  const used = new Set()
  if (Array.isArray(factions)) {
    for (const faction of factions) {
      if (!faction || faction.status !== 'active') continue
      const index = faction.territoryPaletteIndex
      if (Number.isInteger(index) && index >= 0 && index < MAX_ACTIVE_FACTIONS) {
        used.add(index)
      }
    }
  }
  for (let index = 0; index < MAX_ACTIVE_FACTIONS; index += 1) {
    if (!used.has(index)) return index
  }
  return null
}

/**
 * Build an active faction record with an allocated palette slot, or null when at cap.
 *
 * @param {{
 *   id: string,
 *   capitalSettlementId: string,
 *   settlementIds: string[],
 *   emergedEpoch: number,
 *   factions: Array<{ status?: string, territoryPaletteIndex?: number }> | null | undefined,
 * }} params
 * @returns {import('../createDefaultColonizationSlice.js').FactionRecord | null}
 */
export function createActiveFactionRecord(params) {
  const territoryPaletteIndex = allocateTerritoryPaletteIndex(params.factions)
  if (territoryPaletteIndex == null) return null
  return {
    id: params.id,
    capitalSettlementId: params.capitalSettlementId,
    settlementIds: [...params.settlementIds],
    status: /** @type {const} */ ('active'),
    emergedEpoch: params.emergedEpoch,
    territoryPaletteIndex,
  }
}
