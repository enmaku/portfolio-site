/**
 * Political map-cue tooltip model (swords / handshake / sack).
 * Domain: world-builder/CONTEXT.md — Conquest, Quashed rebellion, Populace appeased,
 * Alliance, Trade partner.
 */

import { CONQUEST_CAUSE_QUASHED_REBELLION } from '../core/colonization/politics/conflict/conquestCause.js'
import { POPULACE_APPEASED_CAUSE } from '../core/colonization/politics/softPower/populaceAppeased.js'

/**
 * @typedef {'swords' | 'handshake' | 'sack'} PoliticalMarkerIconKind
 * @typedef {
 *   | 'quashed_rebellion'
 *   | 'conquest'
 *   | 'populace_appeased'
 *   | 'alliance_peer_mint'
 *   | 'alliance_join_existing'
 *   | 'trade_partner'
 * } PoliticalMarkerCueKind
 *
 * @typedef {{
 *   cueKind: PoliticalMarkerCueKind,
 *   title: string,
 *   body: string,
 * }} PoliticalMarkerTooltip
 */

/**
 * @param {{
 *   marker: PoliticalMarkerIconKind,
 *   cause?: string | null,
 *   allianceKind?: string | null,
 * } | null | undefined} payload
 * @returns {PoliticalMarkerTooltip | null}
 */
export function buildPoliticalMarkerTooltip(payload) {
  if (!payload?.marker) return null

  if (payload.marker === 'swords') {
    if (payload.cause === CONQUEST_CAUSE_QUASHED_REBELLION) {
      return {
        cueKind: 'quashed_rebellion',
        title: 'Quashed rebellion',
        body: 'Soft independence began, then the same banner reconquered the seat before an armed rebellion could form.',
      }
    }
    return {
      cueKind: 'conquest',
      title: 'Conquest',
      body: 'This contested settlement joined the victor as a vassal.',
    }
  }

  if (payload.marker === 'handshake') {
    if (payload.allianceKind === 'peer_mint') {
      return {
        cueKind: 'alliance_peer_mint',
        title: 'Alliance',
        body: 'Neighboring free towns allied and minted a new faction.',
      }
    }
    if (payload.cause === POPULACE_APPEASED_CAUSE) {
      return {
        cueKind: 'populace_appeased',
        title: 'Populace appeased',
        body: 'Unrest after soft independence was settled peacefully — political pressure reunited the seat with its former banner as a vassal.',
      }
    }
    return {
      cueKind: 'alliance_join_existing',
      title: 'Alliance',
      body: 'Political pressure swayed this settlement into an existing faction as a vassal.',
    }
  }

  if (payload.marker === 'sack') {
    if (payload.cause === POPULACE_APPEASED_CAUSE) {
      return {
        cueKind: 'populace_appeased',
        title: 'Populace appeased',
        body: 'Unrest after leaving this banner was settled peacefully — commercial soft power rejoined the seat as a trade partner.',
      }
    }
    return {
      cueKind: 'trade_partner',
      title: 'Trade partner',
      body: 'Sticky commercial affiliation under this faction — paints with them, skips faction tax.',
    }
  }

  return null
}
