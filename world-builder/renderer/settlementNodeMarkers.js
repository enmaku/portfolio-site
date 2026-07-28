/** Yellow for living settlement pins. */
export const SETTLEMENT_NODE_OVERLAY_COLOR = 0xffd700

/** Gray for abandoned/ruined settlement pins (matches land route cobblestone). */
export const SETTLEMENT_NODE_RUIN_OVERLAY_COLOR = 0x8e9094

/**
 * Membership-band pin radii (grid cells). Capitals largest; ordinary members and
 * unaligned share the mid size; vassals smallest.
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

/** Mid-band label offset from pin center. */
export const SETTLEMENT_ID_LABEL_OFFSET_X = SETTLEMENT_PIN_RADIUS_MEMBER + SETTLEMENT_ID_LABEL_GAP_X

/** Thin black outline so yellow pins stay readable on yellow faction fill. */
export const SETTLEMENT_PIN_OUTLINE_COLOR = 0x000000

/** Outline width in world/grid units. */
export const SETTLEMENT_PIN_OUTLINE_WIDTH = 0.9

/**
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} factions
 * @returns {'capital' | 'member' | 'vassal' | 'unaligned'}
 */
export function settlementPinMembershipBand(settlement, factions) {
  if (!settlement?.factionId) return 'unaligned'
  if (settlement.vassalLiegeSettlementId) return 'vassal'
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
 * Drawn pin radius for a settlement from membership band.
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @returns {number}
 */
export function settlementPinMarkerRadius(settlement, factions) {
  const band = settlementPinMembershipBand(settlement, factions)
  if (band === 'capital') return SETTLEMENT_PIN_RADIUS_CAPITAL
  if (band === 'vassal') return SETTLEMENT_PIN_RADIUS_VASSAL
  return SETTLEMENT_PIN_RADIUS_MEMBER
}

/**
 * Hover hit radius for a settlement (drawn radius + padding).
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @returns {number}
 */
export function settlementPinHoverRadius(settlement, factions) {
  return settlementPinMarkerRadius(settlement, factions) + SETTLEMENT_PIN_HOVER_PADDING
}

/**
 * Horizontal offset from pin center to the start of the ID label.
 *
 * @param {object} settlement
 * @param {Array<{ id: string, capitalSettlementId?: string, status?: string }> | null | undefined} [factions]
 * @returns {number}
 */
export function settlementIdLabelOffsetX(settlement, factions) {
  return settlementPinMarkerRadius(settlement, factions) + SETTLEMENT_ID_LABEL_GAP_X
}
