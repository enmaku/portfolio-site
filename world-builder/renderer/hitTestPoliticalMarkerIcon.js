/**
 * Hit-test for faction-overlay political map cues (swords / handshake / sack).
 * Domain: world-builder/CONTEXT.md — Conquest, Alliance, Trade partner.
 */

import { livingSettlements } from '../core/colonization/expeditions/expeditionConstants.js'
import { isResourceOverlayVisible } from '../resourceOverlays.js'
import { resolveSettlementNodeOverlayDrawn } from './worldBuilderMapViewportModel.js'
import {
  RECENT_ALLIANCE_ICON_SIZE,
  RECENT_CONQUEST_ICON_SIZE,
  TRADE_PARTNER_ICON_SIZE,
  settlementIdLabelOffsetX,
  shouldShowTradePartnerSackMarker,
  wasAlliedLastEpoch,
  wasConqueredLastEpoch,
  wasTradePartnerJoinedLastEpoch,
} from './settlementNodeMarkers.js'

/**
 * @typedef {'swords' | 'handshake' | 'sack'} PoliticalMarkerIconKind
 *
 * @typedef {{
 *   settlementId: string,
 *   marker: PoliticalMarkerIconKind,
 *   cause?: string | null,
 *   allianceKind?: string | null,
 * }} PoliticalMarkerHit
 */

/**
 * @param {object} settlement
 * @param {Array<object>} factions
 * @param {Array<object>} settlements
 * @param {number} iconSize
 * @returns {{ left: number, top: number, right: number, bottom: number }}
 */
export function politicalMarkerIconBounds(settlement, factions, settlements, iconSize) {
  const left = settlement.x + 0.5 + settlementIdLabelOffsetX(settlement, factions, settlements)
  const midY = settlement.y + 0.5
  const pad = 1.5
  return {
    left: left - pad,
    right: left + iconSize + pad,
    top: midY - iconSize / 2 - pad,
    bottom: midY + iconSize / 2 + pad,
  }
}

/**
 * @param {{ left: number, right: number, top: number, bottom: number }} bounds
 * @param {number} worldX
 * @param {number} worldY
 */
function containsPoint(bounds, worldX, worldY) {
  return (
    worldX >= bounds.left &&
    worldX <= bounds.right &&
    worldY >= bounds.top &&
    worldY <= bounds.bottom
  )
}

/**
 * Prefer swords > handshake > sack (same draw priority). Closest center wins ties.
 *
 * @param {import('../core/types.js').WorldDocument | null | undefined} worldDocument
 * @param {Record<string, boolean> | null | undefined} resourceOverlayVisibility
 * @param {number} worldX
 * @param {number} worldY
 * @returns {PoliticalMarkerHit | null}
 */
export function hitTestPoliticalMarkerIcon(
  worldDocument,
  resourceOverlayVisibility,
  worldX,
  worldY,
) {
  if (!worldDocument) return null
  const visibility = resourceOverlayVisibility ?? {}
  if (!isResourceOverlayVisible(visibility, 'factionTerritory')) return null
  if (!resolveSettlementNodeOverlayDrawn(visibility, worldDocument)) return null

  const factions = worldDocument.factions ?? []
  const settlements = livingSettlements(worldDocument.settlements ?? [])
  const epoch = Number(worldDocument.epoch)
  const recent = worldDocument.recentConquestBySettlementId ?? {}
  const recentAlliance = worldDocument.recentAllianceBySettlementId ?? {}
  const recentTradePartnerJoin = worldDocument.recentTradePartnerJoinBySettlementId ?? {}

  /** @type {{ hit: PoliticalMarkerHit, distSq: number } | null} */
  let best = null

  for (const settlement of settlements) {
    if (typeof settlement.x !== 'number' || typeof settlement.y !== 'number' || !settlement.id) {
      continue
    }

    /** @type {{ marker: PoliticalMarkerIconKind, size: number, cause?: string | null, allianceKind?: string | null } | null} */
    let cue = null
    if (
      wasConqueredLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentConquestBySettlementId: recent,
      })
    ) {
      const entry = recent[settlement.id]
      cue = {
        marker: 'swords',
        size: RECENT_CONQUEST_ICON_SIZE,
        cause: typeof entry?.cause === 'string' ? entry.cause : null,
      }
    } else if (
      wasAlliedLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentAllianceBySettlementId: recentAlliance,
      })
    ) {
      const entry = recentAlliance[settlement.id]
      cue = {
        marker: 'handshake',
        size: RECENT_ALLIANCE_ICON_SIZE,
        allianceKind: typeof entry?.kind === 'string' ? entry.kind : null,
        cause: typeof entry?.cause === 'string' ? entry.cause : null,
      }
    } else if (shouldShowTradePartnerSackMarker(settlement)) {
      const joinEntry = recentTradePartnerJoin[settlement.id]
      const recentJoinFlavor = wasTradePartnerJoinedLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentTradePartnerJoinBySettlementId: recentTradePartnerJoin,
      })
      cue = {
        marker: 'sack',
        size: TRADE_PARTNER_ICON_SIZE,
        cause:
          recentJoinFlavor && typeof joinEntry?.cause === 'string' ? joinEntry.cause : null,
      }
    }

    if (!cue) continue
    const bounds = politicalMarkerIconBounds(settlement, factions, settlements, cue.size)
    if (!containsPoint(bounds, worldX, worldY)) continue

    const left = settlement.x + 0.5 + settlementIdLabelOffsetX(settlement, factions, settlements)
    const midY = settlement.y + 0.5
    const cx = left + cue.size / 2
    const cy = midY
    const dx = worldX - cx
    const dy = worldY - cy
    const distSq = dx * dx + dy * dy
    if (!best || distSq < best.distSq) {
      best = {
        distSq,
        hit: {
          settlementId: settlement.id,
          marker: cue.marker,
          ...(cue.cause !== undefined ? { cause: cue.cause } : {}),
          ...(cue.allianceKind !== undefined ? { allianceKind: cue.allianceKind } : {}),
        },
      }
    }
  }

  return best?.hit ?? null
}
