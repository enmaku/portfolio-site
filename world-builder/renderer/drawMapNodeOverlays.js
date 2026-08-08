import {
  drawCrossedSwordsIcon,
  drawHandshakeIcon,
  drawSackIcon,
  SETTLEMENT_ID_LABEL_COLOR,
  SETTLEMENT_ID_LABEL_FONT_SIZE,
  SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
  SETTLEMENT_ID_LABEL_OUTLINE_WIDTH,
  SETTLEMENT_NODE_OVERLAY_COLOR,
  SETTLEMENT_NODE_RUIN_OVERLAY_COLOR,
  SETTLEMENT_PIN_OUTLINE_COLOR,
  SETTLEMENT_PIN_OUTLINE_WIDTH,
  settlementIdLabelOffsetX,
  settlementPinMarkerRadius,
  shouldShowTradePartnerSackMarker,
  wasAlliedLastEpoch,
  wasConqueredLastEpoch,
} from './settlementNodeMarkers.js'
import {
  mineralNodeOverlayColor,
  resolveMetalsOverlayDrawn,
  resolveSaltNodeOverlayDrawn,
  resolveSettlementIdLabelsDrawn,
  resolveSettlementNodeOverlayDrawn,
} from './worldBuilderMapViewportModel.js'
import { isResourceOverlayVisible } from '../resourceOverlays.js'

/** Fallback color for discrete metal mine markers (matches metals raster hue). */
export const METAL_NODE_OVERLAY_COLOR = 0x000000

/** Pure white for salt strategic-resource markers. */
export const SALT_NODE_OVERLAY_COLOR = 0xffffff

/** Grid-cell radius for metal/salt strategic-resource node markers. */
export const STRATEGIC_RESOURCE_NODE_MARKER_RADIUS = 7

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export function drawCoastalNodes(overlay, worldDocument) {
  overlay.clear()

  if (worldDocument.coastalNodes?.length) {
    for (const node of worldDocument.coastalNodes) {
      const color = coastalNodeColor(node.kind)
      overlay.circle(node.x + 0.5, node.y + 0.5, 2)
      overlay.fill({ color, alpha: 0.85 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawMetalNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveMetalsOverlayDrawn(resourceOverlayVisibility, worldDocument).nodesVisible) {
    for (const node of worldDocument.metalNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: mineralNodeOverlayColor(node.kind), alpha: 0.9 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawSaltNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveSaltNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    for (const node of worldDocument.saltNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: SALT_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawSettlementNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveSettlementNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    const factions = worldDocument.factions ?? []
    const settlements = worldDocument.settlements ?? []
    for (const settlement of settlements) {
      if (typeof settlement.x !== 'number' || typeof settlement.y !== 'number') {
        continue
      }
      const radius = settlementPinMarkerRadius(settlement, factions, settlements)
      overlay.circle(settlement.x + 0.5, settlement.y + 0.5, radius)
      overlay.fill({ color: settlementNodeColor(settlement.status), alpha: 0.9 })
      overlay.stroke({
        width: SETTLEMENT_PIN_OUTLINE_WIDTH,
        color: SETTLEMENT_PIN_OUTLINE_COLOR,
        alpha: 1,
      })
    }
  }
}

/**
 * @param {import('pixi.js').Container} overlay
 */
export function clearSettlementIdLabels(overlay) {
  const removed = overlay.removeChildren()
  for (const child of removed) {
    child.destroy()
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 */
export function clearRecentConquestMarkers(overlay) {
  overlay.clear()
}

/**
 * @param {import('pixi.js').Container} overlay
 * @param {typeof import('pixi.js').Text} TextCtor
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {boolean} kitEnabled
 */
export function drawSettlementIdLabels(overlay, TextCtor, worldDocument, kitEnabled) {
  clearSettlementIdLabels(overlay)

  if (!resolveSettlementIdLabelsDrawn(kitEnabled, worldDocument)) {
    return
  }

  const factions = worldDocument.factions ?? []
  const settlements = worldDocument.settlements ?? []
  for (const settlement of settlements) {
    if (
      !Number.isInteger(settlement.mapNumber) ||
      settlement.mapNumber < 1 ||
      typeof settlement.x !== 'number' ||
      typeof settlement.y !== 'number'
    ) {
      continue
    }
    const label = new TextCtor({
      text: String(settlement.mapNumber),
      style: {
        fontFamily: 'Arial',
        fontSize: SETTLEMENT_ID_LABEL_FONT_SIZE,
        fill: SETTLEMENT_ID_LABEL_COLOR,
        stroke: {
          color: SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
          width: SETTLEMENT_ID_LABEL_OUTLINE_WIDTH,
        },
      },
    })
    label.anchor.set(0, 0.5)
    label.x = settlement.x + 0.5 + settlementIdLabelOffsetX(settlement, factions, settlements)
    label.y = settlement.y + 0.5
    overlay.addChild(label)
  }
}

/**
 * Recent-conquest swords and recent-alliance handshake (one-epoch flash) plus
 * lasting trade-partner sack status cues, only while the faction territory
 * overlay toggle is on.
 *
 * @param {import('pixi.js').Graphics} overlay
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawRecentConquestMarkers(
  overlay,
  GraphicsPathCtor,
  worldDocument,
  resourceOverlayVisibility,
) {
  clearRecentConquestMarkers(overlay)

  if (!isResourceOverlayVisible(resourceOverlayVisibility, 'factionTerritory')) {
    return
  }
  if (!resolveSettlementNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    return
  }

  const factions = worldDocument.factions ?? []
  const settlements = worldDocument.settlements ?? []
  const epoch = Number(worldDocument.epoch)
  const recent = worldDocument.recentConquestBySettlementId ?? {}
  const recentAlliance = worldDocument.recentAllianceBySettlementId ?? {}

  for (const settlement of settlements) {
    if (
      settlement.status === 'ruin' ||
      typeof settlement.x !== 'number' ||
      typeof settlement.y !== 'number' ||
      !settlement.id
    ) {
      continue
    }
    const left = settlement.x + 0.5 + settlementIdLabelOffsetX(settlement, factions, settlements)
    const midY = settlement.y + 0.5

    if (
      wasConqueredLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentConquestBySettlementId: recent,
      })
    ) {
      drawCrossedSwordsIcon(overlay, left, midY, GraphicsPathCtor)
      continue
    }

    if (
      wasAlliedLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentAllianceBySettlementId: recentAlliance,
      })
    ) {
      drawHandshakeIcon(overlay, left, midY, GraphicsPathCtor)
      continue
    }

    if (shouldShowTradePartnerSackMarker(settlement)) {
      drawSackIcon(overlay, left, midY, GraphicsPathCtor)
    }
  }
}

/** @param {string | undefined} status */
function settlementNodeColor(status) {
  return status === 'ruin' ? SETTLEMENT_NODE_RUIN_OVERLAY_COLOR : SETTLEMENT_NODE_OVERLAY_COLOR
}

/** @param {import('../core/types.js').CoastalNodeKind} kind */
function coastalNodeColor(kind) {
  switch (kind) {
    case 'mouth':
      return 0x4fc3f7
    case 'strait':
      return 0xffb74d
    case 'anchorage':
      return 0x81c784
    case 'extraction':
      return 0xce93d8
    default:
      return 0xffffff
  }
}
