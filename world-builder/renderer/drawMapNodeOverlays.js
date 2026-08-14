import { isSameBannerEpochReunification } from '../core/colonization/politics/sameBannerReunification.js'
import {
  drawCrossedSwordsIcon,
  drawHandshakeIcon,
  drawSackIcon,
  RECENT_ALLIANCE_ICON_COLOR,
  RECENT_CONQUEST_ICON_COLOR,
  REUNIFICATION_MARKER_ICON_COLOR,
  SETTLEMENT_ID_LABEL_COLOR,
  SETTLEMENT_ID_LABEL_FONT_SIZE,
  SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
  SETTLEMENT_ID_LABEL_OUTLINE_WIDTH,
  SETTLEMENT_ID_LABEL_WRITEUP_HIGHLIGHT_COLOR,
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
import { attachNameOverlayEditHandler } from './attachNameOverlayEditHandler.js'
import {
  resolveMetalsOverlayDrawn,
  resolveSaltNodeOverlayDrawn,
  resolveSettlementIdLabelsDrawn,
  resolveSettlementNodeOverlayDrawn,
} from './worldBuilderMapViewportModel.js'
import { isResourceOverlayVisible } from '../resourceOverlays.js'
import {
  drawMineralDepositIcon,
  drawSaltDepositIcon,
  SALT_NODE_OVERLAY_COLOR,
} from './strategicResourceNodeMarkers.js'

/** Fallback color for discrete metal mine markers (matches metals raster hue). */
export const METAL_NODE_OVERLAY_COLOR = 0x000000

export { SALT_NODE_OVERLAY_COLOR }

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
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawMetalNodes(overlay, GraphicsPathCtor, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveMetalsOverlayDrawn(resourceOverlayVisibility, worldDocument).nodesVisible) {
    for (const node of worldDocument.metalNodes) {
      drawMineralDepositIcon(
        overlay,
        node.x + 0.5,
        node.y + 0.5,
        node.kind,
        GraphicsPathCtor,
      )
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
export function drawSaltNodes(overlay, GraphicsPathCtor, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveSaltNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    for (const node of worldDocument.saltNodes) {
      drawSaltDepositIcon(overlay, node.x + 0.5, node.y + 0.5, GraphicsPathCtor)
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
 * @param {{
 *   customNamesVisible?: boolean,
 *   customNamesBySettlementId?: Record<string, string> | null,
 *   highlightedSettlementIds?: ReadonlySet<string> | Iterable<string> | null,
 *   onEdit?: ((payload: import('./attachNameOverlayEditHandler.js').NameOverlayEditTarget) => void) | null,
 * }} [options]
 */
export function drawSettlementIdLabels(overlay, TextCtor, worldDocument, kitEnabled, options) {
  clearSettlementIdLabels(overlay)

  const customNamesVisible = options?.customNamesVisible === true
  const customNamesBySettlementId = options?.customNamesBySettlementId ?? {}
  const highlightedSettlementIds = new Set(options?.highlightedSettlementIds ?? [])
  const drawCustomNames = customNamesVisible

  if (!drawCustomNames && !resolveSettlementIdLabelsDrawn(kitEnabled, worldDocument)) {
    return
  }
  if (drawCustomNames && !worldDocument.settlements?.length) {
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
    const customName =
      drawCustomNames && typeof settlement.id === 'string'
        ? customNamesBySettlementId[settlement.id]
        : null
    const text =
      typeof customName === 'string' && customName.trim()
        ? customName.trim()
        : drawCustomNames
          ? `#${settlement.mapNumber}`
          : String(settlement.mapNumber)
    const highlighted =
      drawCustomNames &&
      typeof settlement.id === 'string' &&
      highlightedSettlementIds.has(settlement.id)
    const label = new TextCtor({
      text,
      style: {
        fontFamily: 'Arial',
        fontSize: SETTLEMENT_ID_LABEL_FONT_SIZE,
        fill: highlighted
          ? SETTLEMENT_ID_LABEL_WRITEUP_HIGHLIGHT_COLOR
          : SETTLEMENT_ID_LABEL_COLOR,
        stroke: {
          color: SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
          width: SETTLEMENT_ID_LABEL_OUTLINE_WIDTH,
        },
      },
    })
    label.anchor.set(0, 0.5)
    label.x = settlement.x + 0.5 + settlementIdLabelOffsetX(settlement, factions, settlements)
    label.y = settlement.y + 0.5
    if (drawCustomNames && typeof settlement.id === 'string') {
      attachNameOverlayEditHandler(label, { kind: 'settlement', id: settlement.id }, options?.onEdit)
    }
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
      const reunify = isSameBannerEpochReunification(
        worldDocument,
        settlement.id,
        settlement.factionId,
      )
      drawCrossedSwordsIcon(
        overlay,
        left,
        midY,
        GraphicsPathCtor,
        reunify ? REUNIFICATION_MARKER_ICON_COLOR : RECENT_CONQUEST_ICON_COLOR,
      )
      continue
    }

    if (
      wasAlliedLastEpoch({
        settlementId: settlement.id,
        epoch,
        recentAllianceBySettlementId: recentAlliance,
      })
    ) {
      const reunify = isSameBannerEpochReunification(
        worldDocument,
        settlement.id,
        settlement.factionId,
      )
      drawHandshakeIcon(
        overlay,
        left,
        midY,
        GraphicsPathCtor,
        reunify ? REUNIFICATION_MARKER_ICON_COLOR : RECENT_ALLIANCE_ICON_COLOR,
      )
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
