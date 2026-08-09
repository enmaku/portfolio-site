import {
  factionHasTerritoryColor,
} from '../core/colonization/politics/factionCap.js'

/** Yellow for living settlement pins. */
export const SETTLEMENT_NODE_OVERLAY_COLOR = 0xffd700

/** Gray for abandoned/ruined settlement pins (matches land route cobblestone). */
export const SETTLEMENT_NODE_RUIN_OVERLAY_COLOR = 0x8e9094

/**
 * Membership-band pin radii (grid cells). Capitals largest; ordinary members and
 * unaligned (including singleton factions) share the mid size; vassals smallest.
 */
export const SETTLEMENT_PIN_RADIUS_CAPITAL = 7
export const SETTLEMENT_PIN_RADIUS_MEMBER = 5
export const SETTLEMENT_PIN_RADIUS_VASSAL = 3.5

/** Mid-band radius; also the legacy default pin size. */
export const SETTLEMENT_NODE_MARKER_RADIUS = SETTLEMENT_PIN_RADIUS_MEMBER

/** Extra grid cells beyond drawn radius for hover hit testing. */
export const SETTLEMENT_PIN_HOVER_PADDING = 2

/** Mid-band hover radius (member / unaligned). */
export const SETTLEMENT_NODE_HOVER_RADIUS =
  SETTLEMENT_PIN_RADIUS_MEMBER + SETTLEMENT_PIN_HOVER_PADDING

/** Yellow fill for settlement ID labels (matches living pins). */
export const SETTLEMENT_ID_LABEL_COLOR = SETTLEMENT_NODE_OVERLAY_COLOR

/** Thin black outline around settlement ID label glyphs. */
export const SETTLEMENT_ID_LABEL_OUTLINE_COLOR = 0x000000

/** Outline width in world/grid units. */
export const SETTLEMENT_ID_LABEL_OUTLINE_WIDTH = 2

/** Label font size in world/grid units. */
export const SETTLEMENT_ID_LABEL_FONT_SIZE = 14

/** Horizontal gap from pin edge to the start of the ID label. */
export const SETTLEMENT_ID_LABEL_GAP_X = 2

/** Horizontal offset from pin center to the start of the ID label. */
export const SETTLEMENT_ID_LABEL_OFFSET_X = SETTLEMENT_PIN_RADIUS_MEMBER + SETTLEMENT_ID_LABEL_GAP_X

/** Thin black outline so yellow pins stay readable on yellow faction fill. */
export const SETTLEMENT_PIN_OUTLINE_COLOR = 0x000000

/** Outline width in world/grid units. */
export const SETTLEMENT_PIN_OUTLINE_WIDTH = 0.9

/** Red fill for ordinary recent-conquest swords. */
export const RECENT_CONQUEST_ICON_COLOR = 0xff0000

/**
 * Yellow-orange fill for reunification flavors on one-epoch flash cues
 * (quashed rebellion swords / populace appeased handshake) so they separate
 * from red conquest and green alliance. Trade-partner sack stay gold always.
 */
export const REUNIFICATION_MARKER_ICON_COLOR = 0xff9800

/** Black outline matching settlement pin / ID label outline. */
export const RECENT_CONQUEST_ICON_OUTLINE_COLOR = SETTLEMENT_ID_LABEL_OUTLINE_COLOR

/** Outline width in world/grid units. */
export const RECENT_CONQUEST_ICON_OUTLINE_WIDTH = 1.6

/** Drawn size of the swords icon in world/grid units. */
export const RECENT_CONQUEST_ICON_SIZE = 12

/**
 * Material Symbols Outlined `swords` path `d` (24px / fill1), viewBox `0 -960 960 960`.
 * Apache-2.0 — https://github.com/google/material-design-icons
 */
export const RECENT_CONQUEST_SWORDS_PATH_D =
  'M762-96 645-212l-88 88-28-28q-23-23-23-57t23-57l169-169q23-23 57-23t57 23l28 28-88 88 116 117q12 12 12 28t-12 28l-50 50q-12 12-28 12t-28-12Zm118-628L426-270l5 4q23 23 23 57t-23 57l-28 28-88-88L198-96q-12 12-28 12t-28-12l-50-50q-12-12-12-28t12-28l116-117-88-88 28-28q23-23 57-23t57 23l4 5 454-454h160v160ZM278-526 80-724v-160h160l198 198-160 160Z'

/** Material Symbols viewBox width/height. */
export const RECENT_CONQUEST_SWORDS_VIEWBOX = 960

/**
 * Draw Material Symbols crossed-swords at the left-middle anchor `(left, midY)`.
 * Path geometry is stroked black then filled — no icon font / ligature.
 *
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} left
 * @param {number} midY
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 * @param {number} [fillColor=RECENT_CONQUEST_ICON_COLOR]
 */
export function drawCrossedSwordsIcon(
  graphics,
  left,
  midY,
  GraphicsPathCtor,
  fillColor = RECENT_CONQUEST_ICON_COLOR,
) {
  const size = RECENT_CONQUEST_ICON_SIZE
  const scale = size / RECENT_CONQUEST_SWORDS_VIEWBOX
  const cx = left + size / 2
  const cy = midY
  const path = new GraphicsPathCtor(RECENT_CONQUEST_SWORDS_PATH_D)

  graphics.save()
  graphics.setTransform(scale, 0, 0, scale, cx - 480 * scale, cy + 480 * scale)
  graphics.path(path)
  graphics.stroke({
    width: RECENT_CONQUEST_ICON_OUTLINE_WIDTH,
    color: RECENT_CONQUEST_ICON_OUTLINE_COLOR,
    alpha: 1,
  })
  graphics.path(path)
  graphics.fill({ color: fillColor, alpha: 1 })
  graphics.restore()
}

/**
 * How many epochs a conquest cue stays on the map (inclusive of the conquest epoch).
 * One epoch only: cue is present after the tick that took the pin, gone after the next.
 */
export const RECENT_CONQUEST_MARKER_EPOCHS = 1

/** Green fill for ordinary recent-alliance handshake. */
export const RECENT_ALLIANCE_ICON_COLOR = 0x4caf50

/** Black outline matching settlement pin / ID label outline. */
export const RECENT_ALLIANCE_ICON_OUTLINE_COLOR = SETTLEMENT_ID_LABEL_OUTLINE_COLOR

/**
 * Outline width in world/grid units. Pixi stroke width is not scaled by the icon
 * transform; match swords weight so thin silhouettes stay readable on faction fill.
 */
export const RECENT_ALLIANCE_ICON_OUTLINE_WIDTH = 1.6

/**
 * Drawn size in world/grid units. Larger than swords: figures only fill the lower
 * band of the Material viewBox once the diamond is stripped.
 */
export const RECENT_ALLIANCE_ICON_SIZE = 16

/**
 * Material Symbols Outlined `partner_exchange` path `d` (24px), viewBox `0 -960 960 960`,
 * with the top diamond subpath removed (two figures + joined arms only).
 * Apache-2.0 — https://github.com/google/material-design-icons
 */
export const RECENT_ALLIANCE_HANDSHAKE_PATH_D =
  'M40-160v-160q0-34 23.5-57t56.5-23h131q20 0 38 10t29 27q29 39 71.5 61t90.5 22q49 0 91.5-22t70.5-61q13-17 30.5-27t36.5-10h131q34 0 57 23t23 57v160H640v-91q-35 25-75.5 38T480-200q-43 0-84-13.5T320-252v92H40Zm120-280q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T280-560q0 50-34.5 85T160-440Zm640 0q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T920-560q0 50-34.5 85T800-440Z'

/** Material Symbols viewBox width/height. */
export const RECENT_ALLIANCE_HANDSHAKE_VIEWBOX = 960

/** Path-space Y of the figure centroid (no diamond) for vertical centering. */
const RECENT_ALLIANCE_PATH_CENTER_Y = -340

/**
 * Draw edited Material Symbols `partner_exchange` (no diamond) at `(left, midY)`.
 * Stroke black then fill (same paint order as swords). Stroke width is world
 * units — not ÷viewBox scale.
 *
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} left
 * @param {number} midY
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 * @param {number} [fillColor=RECENT_ALLIANCE_ICON_COLOR]
 */
export function drawHandshakeIcon(
  graphics,
  left,
  midY,
  GraphicsPathCtor,
  fillColor = RECENT_ALLIANCE_ICON_COLOR,
) {
  const size = RECENT_ALLIANCE_ICON_SIZE
  const scale = size / RECENT_ALLIANCE_HANDSHAKE_VIEWBOX
  const cx = left + size / 2
  const cy = midY
  const path = new GraphicsPathCtor(RECENT_ALLIANCE_HANDSHAKE_PATH_D)

  graphics.save()
  graphics.setTransform(
    scale,
    0,
    0,
    scale,
    cx - 480 * scale,
    cy - RECENT_ALLIANCE_PATH_CENTER_Y * scale,
  )
  graphics.path(path)
  graphics.stroke({
    width: RECENT_ALLIANCE_ICON_OUTLINE_WIDTH,
    color: RECENT_ALLIANCE_ICON_OUTLINE_COLOR,
    alpha: 1,
  })
  graphics.path(path)
  graphics.fill({ color: fillColor, alpha: 1 })
  graphics.restore()
}

/**
 * Same temporal family as conquest: visible for the alliance epoch only.
 */
export const RECENT_ALLIANCE_MARKER_EPOCHS = RECENT_CONQUEST_MARKER_EPOCHS

/**
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} factions
 * @param {Array<object> | null | undefined} [settlements] Living roster for singleton-faction checks.
 * @returns {'capital' | 'member' | 'vassal' | 'tradePartner' | 'unaligned'}
 */
export function settlementPinMembershipBand(settlement, factions, settlements) {
  if (!settlement?.factionId) return 'unaligned'
  const roster = settlements ?? inferSettlementsFromFactions(factions)
  if (!factionHasTerritoryColor(settlement.factionId, { settlements: roster })) {
    return 'unaligned'
  }
  if (settlement.vassalLiegeSettlementId) return 'vassal'
  if (settlement.isTradePartner === true) return 'tradePartner'
  if (
    Array.isArray(factions) &&
    factions.some(
      (f) =>
        f &&
        f.id === settlement.factionId &&
        f.capitalSettlementId === settlement.id &&
        f.status !== 'extinct',
    )
  ) {
    return 'capital'
  }
  return 'member'
}

/**
 * @param {Array<{ id?: string, settlementIds?: string[] }> | null | undefined} factions
 * @returns {object[]}
 */
function inferSettlementsFromFactions(factions) {
  /** @type {object[]} */
  const rows = []
  if (!Array.isArray(factions)) return rows
  for (const faction of factions) {
    if (!faction?.id) continue
    for (const id of faction.settlementIds ?? []) {
      rows.push({ id, factionId: faction.id, status: 'living', population: 1 })
    }
  }
  return rows
}

/**
 * Drawn pin radius for a settlement from membership band.
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @param {Array<object> | null | undefined} [settlements]
 * @returns {number}
 */
export function settlementPinMarkerRadius(settlement, factions, settlements) {
  const band = settlementPinMembershipBand(settlement, factions, settlements)
  if (band === 'capital') return SETTLEMENT_PIN_RADIUS_CAPITAL
  if (band === 'vassal') return SETTLEMENT_PIN_RADIUS_VASSAL
  return SETTLEMENT_PIN_RADIUS_MEMBER
}

/**
 * Hover hit radius for a settlement (drawn radius + padding).
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @param {Array<object> | null | undefined} [settlements]
 * @returns {number}
 */
export function settlementPinHoverRadius(settlement, factions, settlements) {
  return settlementPinMarkerRadius(settlement, factions, settlements) + SETTLEMENT_PIN_HOVER_PADDING
}

/**
 * Horizontal offset from pin center to the start of the ID label.
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @param {Array<object> | null | undefined} [settlements]
 * @returns {number}
 */
export function settlementIdLabelOffsetX(settlement, factions, settlements) {
  return settlementPinMarkerRadius(settlement, factions, settlements) + SETTLEMENT_ID_LABEL_GAP_X
}

/**
 * True when the settlement was conquered recently enough to show the map cue
 * (politics stamps `conqueredEpoch` after ruin advances `epoch`).
 *
 * @param {{
 *   settlementId: string,
 *   epoch: number,
 *   recentConquestBySettlementId?: Record<string, { conqueredEpoch?: number } | null | undefined> | null,
 *   markerEpochs?: number,
 * }} params
 * @returns {boolean}
 */
export function wasConqueredLastEpoch(params) {
  const entry = params.recentConquestBySettlementId?.[params.settlementId]
  if (!entry || !Number.isFinite(entry.conqueredEpoch)) return false
  const age = params.epoch - entry.conqueredEpoch
  if (!(age >= 0)) return false
  const window = Number.isFinite(params.markerEpochs)
    ? Number(params.markerEpochs)
    : RECENT_CONQUEST_MARKER_EPOCHS
  return age < window
}

/**
 * True when the settlement allied recently enough to show the map cue
 * (politics stamps `allianceEpoch` in the same epoch the membership flip commits).
 *
 * @param {{
 *   settlementId: string,
 *   epoch: number,
 *   recentAllianceBySettlementId?: Record<string, { allianceEpoch?: number } | null | undefined> | null,
 *   markerEpochs?: number,
 * }} params
 * @returns {boolean}
 */
export function wasAlliedLastEpoch(params) {
  const entry = params.recentAllianceBySettlementId?.[params.settlementId]
  if (!entry || !Number.isFinite(entry.allianceEpoch)) return false
  const age = params.epoch - entry.allianceEpoch
  if (!(age >= 0)) return false
  const window = Number.isFinite(params.markerEpochs)
    ? Number(params.markerEpochs)
    : RECENT_ALLIANCE_MARKER_EPOCHS
  return age < window
}

/**
 * True when a trade-partner join is recent enough for one-epoch flavor chrome.
 *
 * @param {{
 *   settlementId: string,
 *   epoch: number,
 *   recentTradePartnerJoinBySettlementId?: Record<string, { joinedEpoch?: number } | null | undefined> | null,
 *   markerEpochs?: number,
 * }} params
 * @returns {boolean}
 */
export function wasTradePartnerJoinedLastEpoch(params) {
  const entry = params.recentTradePartnerJoinBySettlementId?.[params.settlementId]
  if (!entry || !Number.isFinite(entry.joinedEpoch)) return false
  const age = params.epoch - entry.joinedEpoch
  if (!(age >= 0)) return false
  const window = Number.isFinite(params.markerEpochs)
    ? Number(params.markerEpochs)
    : RECENT_ALLIANCE_MARKER_EPOCHS
  return age < window
}

/** Gold-brown sack fill matching tooltip moneyBagIcon (`#C9A227`). */
export const TRADE_PARTNER_ICON_COLOR = 0xc9a227

/** Black outline so the sack stays readable on brown faction fills. */
export const TRADE_PARTNER_ICON_OUTLINE_COLOR = SETTLEMENT_ID_LABEL_OUTLINE_COLOR

/** Outline width in world/grid units. */
export const TRADE_PARTNER_ICON_OUTLINE_WIDTH = 1.2

/** Drawn size of the sack icon in world/grid units. */
export const TRADE_PARTNER_ICON_SIZE = 11

/**
 * MDI `mdiSack` path `d` (viewBox 0 0 24 24).
 * Apache-2.0 — https://github.com/Templarian/MaterialDesign
 */
export const TRADE_PARTNER_SACK_PATH_D =
  'M16,9C20,11 21,18 21,18C21,18 22,22 16,22C10,22 8,22 8,22C2,22 3,18 3,18C3,18 4,11 8,9M14,4L12,2L10,4L6,2L8,7H16L18,2L14,4Z'

/** MDI viewBox width/height. */
export const TRADE_PARTNER_SACK_VIEWBOX = 24

/**
 * Draw mdiSack at the left-middle anchor `(left, midY)` with thin black outline.
 * Permanent trade-partner status cue (not a one-epoch flash).
 *
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} left
 * @param {number} midY
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 */
export function drawSackIcon(graphics, left, midY, GraphicsPathCtor) {
  const size = TRADE_PARTNER_ICON_SIZE
  const scale = size / TRADE_PARTNER_SACK_VIEWBOX
  const cx = left + size / 2
  const cy = midY
  const path = new GraphicsPathCtor(TRADE_PARTNER_SACK_PATH_D)

  graphics.save()
  graphics.setTransform(scale, 0, 0, scale, cx - 12 * scale, cy - 12 * scale)
  graphics.path(path)
  graphics.stroke({
    width: TRADE_PARTNER_ICON_OUTLINE_WIDTH / scale,
    color: TRADE_PARTNER_ICON_OUTLINE_COLOR,
    alpha: 1,
  })
  graphics.path(path)
  graphics.fill({ color: TRADE_PARTNER_ICON_COLOR, alpha: 1 })
  graphics.restore()
}

/**
 * Living sticky trade partners show the sack while they skip the levy.
 * Soft-power paint alone does not qualify; taxed membership clears the cue.
 *
 * @param {object | null | undefined} settlement
 * @returns {boolean}
 */
export function shouldShowTradePartnerSackMarker(settlement) {
  if (!settlement || settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return settlement.isTradePartner === true && Boolean(settlement.factionId)
}

