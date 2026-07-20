/** Yellow for living settlement pins. */
export const SETTLEMENT_NODE_OVERLAY_COLOR = 0xffd700

/** Gray for abandoned/ruined settlement pins (matches land route cobblestone). */
export const SETTLEMENT_NODE_RUIN_OVERLAY_COLOR = 0x8e9094

/** Grid-cell radius for settlement pins. */
export const SETTLEMENT_NODE_MARKER_RADIUS = 5

/** Grid-cell hover hit radius (larger than the drawn pin). */
export const SETTLEMENT_NODE_HOVER_RADIUS = 7

/** Yellow fill for settlement ID labels (matches living pins). */
export const SETTLEMENT_ID_LABEL_COLOR = SETTLEMENT_NODE_OVERLAY_COLOR

/** Thin black outline around settlement ID label glyphs. */
export const SETTLEMENT_ID_LABEL_OUTLINE_COLOR = 0x000000

/** Outline width in world/grid units. */
export const SETTLEMENT_ID_LABEL_OUTLINE_WIDTH = 2

/** Label font size in world/grid units. */
export const SETTLEMENT_ID_LABEL_FONT_SIZE = 14

/** Horizontal offset from pin center to the start of the ID label. */
export const SETTLEMENT_ID_LABEL_OFFSET_X = SETTLEMENT_NODE_MARKER_RADIUS + 2
