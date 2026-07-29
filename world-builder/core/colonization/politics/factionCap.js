/**
 * Active-faction roster cap (matches ColorBrewer qualitative set length).
 * Territory colors are for multi-settlement alignment only: singleton factions
 * paint as unaligned gray and do not hold a palette slot.
 * Domain: world-builder/CONTEXT.md — Faction territory overlay; Faction.
 */

import { MAX_ACTIVE_FACTIONS } from './politicsConstants.js'
import {
  countLivingFactionControl,
  factionHasTerritoryColorByControl,
} from './softPower/factionalControl.js'

export { MAX_ACTIVE_FACTIONS }

/**
 * @param {object | null | undefined} settlement
 * @returns {boolean}
 */
function isLivingSettlement(settlement) {
  if (!settlement) return false
  if (settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return true
}

/**
 * Living member count for a faction (settlements array preferred; else roster ids).
 *
 * @param {string} factionId
 * @param {{
 *   settlements?: Array<{ id?: string, factionId?: string | null, status?: string, population?: number }> | null,
 *   settlementIds?: string[] | null,
 * } | null | undefined} [opts]
 * @returns {number}
 */
export function countLivingFactionMembers(factionId, opts) {
  if (!factionId) return 0
  const settlements = opts?.settlements
  if (Array.isArray(settlements)) {
    let count = 0
    for (const settlement of settlements) {
      if (!isLivingSettlement(settlement)) continue
      if (settlement.factionId !== factionId) continue
      count += 1
    }
    // Prefer the settlement scan when any living pins exist for this faction,
    // or when the caller omitted roster ids. Fall back to roster length when
    // minting a record before settlements are rewritten.
    if (count > 0 || !Array.isArray(opts?.settlementIds)) return count
  }
  const ids = opts?.settlementIds
  return Array.isArray(ids) ? ids.length : 0
}

/**
 * True when a faction should take a territory color (2+ living members).
 *
 * @param {string} factionId
 * @param {{
 *   settlements?: Array<{ id?: string, factionId?: string | null, status?: string, population?: number }> | null,
 *   settlementIds?: string[] | null,
 * } | null | undefined} [opts]
 * @returns {boolean}
 */
export function factionHasTerritoryColor(factionId, opts) {
  return countLivingFactionMembers(factionId, opts) >= 2
}

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
 * Lowest free territory palette slot among multi-settlement active factions.
 *
 * @param {Array<{
 *   id?: string,
 *   status?: string,
 *   territoryPaletteIndex?: number,
 *   settlementIds?: string[],
 * }> | null | undefined} factions
 * @param {Array<{ id?: string, factionId?: string | null, status?: string, population?: number }> | null | undefined} [settlements]
 * @returns {number | null}
 */
export function allocateTerritoryPaletteIndex(factions, settlements) {
  if (!canMintNewFaction(factions)) return null
  const used = new Set()
  if (Array.isArray(factions)) {
    for (const faction of factions) {
      if (!faction || faction.status !== 'active') continue
      if (
        !factionHasTerritoryColor(faction.id ?? '', {
          settlements,
          settlementIds: faction.settlementIds,
        })
      ) {
        continue
      }
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
 * Release palette slots when control drops below 2; assign when control reaches 2+.
 *
 * @param {{
 *   factions: Array<object> | null | undefined,
 *   settlements: Array<object> | null | undefined,
 *   softPowerPaintBySettlementId?: Record<string, string> | null,
 * }} params
 * @returns {Array<object>}
 */
export function syncFactionTerritoryPalettes(params) {
  const factions = Array.isArray(params.factions) ? params.factions : []
  const settlements = params.settlements ?? []
  const softPowerPaintBySettlementId = params.softPowerPaintBySettlementId ?? {}
  const controlOpts = { settlements, factions, softPowerPaintBySettlementId }
  /** @type {Array<object>} */
  const next = factions.map((faction) => ({ ...faction }))

  for (const faction of next) {
    if (!faction || faction.status !== 'active') continue
    const living = countLivingFactionControl(faction.id, controlOpts)
    if (living < 2) {
      if (faction.territoryPaletteIndex != null) {
        delete faction.territoryPaletteIndex
      }
    }
  }

  for (const faction of next) {
    if (!faction || faction.status !== 'active') continue
    if (!factionHasTerritoryColorByControl(faction.id, controlOpts)) continue
    const index = faction.territoryPaletteIndex
    if (Number.isInteger(index) && index >= 0 && index < MAX_ACTIVE_FACTIONS) continue
    const allocated = allocateTerritoryPaletteIndex(next, settlements)
    if (allocated == null) continue
    faction.territoryPaletteIndex = allocated
  }

  return next
}

/**
 * Build an active faction record. Multi-settlement mints take a palette slot;
 * singletons stay colorless (map-unaligned) until they gain a second living pin.
 *
 * @param {{
 *   id: string,
 *   capitalSettlementId: string,
 *   settlementIds: string[],
 *   emergedEpoch: number,
 *   factions: Array<{ status?: string, territoryPaletteIndex?: number, settlementIds?: string[] }> | null | undefined,
 *   settlements?: Array<{ id?: string, factionId?: string | null, status?: string, population?: number }> | null,
 * }} params
 * @returns {import('../createDefaultColonizationSlice.js').FactionRecord | null}
 */
export function createActiveFactionRecord(params) {
  if (!canMintNewFaction(params.factions)) return null
  const settlementIds = [...params.settlementIds]
  // Mint-time color gate uses roster size; settlements may not list the new banner yet.
  const colored = settlementIds.length >= 2
  /** @type {import('../createDefaultColonizationSlice.js').FactionRecord} */
  const record = {
    id: params.id,
    capitalSettlementId: params.capitalSettlementId,
    settlementIds,
    status: /** @type {const} */ ('active'),
    emergedEpoch: params.emergedEpoch,
  }
  if (!colored) return record
  const territoryPaletteIndex = allocateTerritoryPaletteIndex(params.factions, params.settlements)
  if (territoryPaletteIndex == null) return null
  record.territoryPaletteIndex = territoryPaletteIndex
  return record
}
