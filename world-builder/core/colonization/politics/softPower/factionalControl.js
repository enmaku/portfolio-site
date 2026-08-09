/**
 * Factional control attribution for territory overlay (membership + soft power).
 * Domain: world-builder/CONTEXT.md — Factional control; ADR 0021.
 */

import { countLivingFactionMembers } from '../factionCap.js'

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
 * Map-gray seats eligible for non-membership soft-power paint:
 * unaligned, or sticky members of singleton-membership factions.
 *
 * @param {{
 *   settlements?: Array<object> | null,
 *   factions?: Array<object> | null,
 * }} params
 * @returns {Set<string>}
 */
export function resolveMapGraySettlementIds(params) {
  const settlements = Array.isArray(params.settlements) ? params.settlements : []
  /** @type {Set<string>} */
  const gray = new Set()
  for (const settlement of settlements) {
    if (!isLivingSettlement(settlement) || typeof settlement.id !== 'string') continue
    if (!settlement.factionId) {
      gray.add(settlement.id)
      continue
    }
    const members = countLivingFactionMembers(settlement.factionId, { settlements })
    if (members < 2) gray.add(settlement.id)
  }
  return gray
}

/**
 * Who the faction territory overlay attributes a living settlement to.
 * Multi-member sticky membership wins; else armed soft-power on map-gray seats;
 * else singleton sticky membership (counts toward control; ColorBrewer still needs ≥2).
 *
 * @param {object | null | undefined} settlement
 * @param {{
 *   softPowerPaintBySettlementId?: Record<string, string> | null,
 *   factions?: Array<object> | null,
 *   settlements?: Array<object> | null,
 * }} opts
 * @returns {string | null}
 */
export function resolveFactionalController(settlement, opts) {
  if (!isLivingSettlement(settlement) || typeof settlement.id !== 'string') return null
  const settlements = Array.isArray(opts.settlements) ? opts.settlements : []
  const paint = opts.softPowerPaintBySettlementId ?? {}
  const soft = paint[settlement.id]
  const softId = typeof soft === 'string' && soft.length > 0 ? soft : null

  if (settlement.factionId) {
    const members = countLivingFactionMembers(settlement.factionId, { settlements })
    if (members >= 2) return settlement.factionId
    // Singleton / map-unaligned: soft power may override for commercial spheres.
    if (softId) return softId
    return settlement.factionId
  }

  return softId
}

/**
 * Living pins controlled by a faction (sticky membership + soft paint seats).
 *
 * @param {string} factionId
 * @param {{
 *   settlements?: Array<object> | null,
 *   factions?: Array<object> | null,
 *   softPowerPaintBySettlementId?: Record<string, string> | null,
 * }} opts
 * @returns {number}
 */
export function countLivingFactionControl(factionId, opts) {
  if (!factionId) return 0
  const settlements = Array.isArray(opts.settlements) ? opts.settlements : []
  let count = 0
  for (const settlement of settlements) {
    if (!isLivingSettlement(settlement)) continue
    if (resolveFactionalController(settlement, opts) === factionId) count += 1
  }
  return count
}

/**
 * ColorBrewer eligibility: controls two or more living pins.
 *
 * @param {string} factionId
 * @param {{
 *   settlements?: Array<object> | null,
 *   factions?: Array<object> | null,
 *   softPowerPaintBySettlementId?: Record<string, string> | null,
 * }} opts
 * @returns {boolean}
 */
export function factionHasTerritoryColorByControl(factionId, opts) {
  return countLivingFactionControl(factionId, opts) >= 2
}
