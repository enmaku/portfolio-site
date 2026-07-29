/**
 * Faction-territory hover hit testing (primary-claim cells).
 * Domain: world-builder/CONTEXT.md — Faction territory overlay.
 */

import { SEA_LEVEL } from '../core/biomeIds.js'
import { factionHasTerritoryColor } from '../core/colonization/politics/factionCap.js'

/**
 * @typedef {import('./buildFactionTerritoryOverlayRgba.js').FactionTerritoryHighlight} FactionTerritoryHighlight
 */

/**
 * @param {FactionTerritoryHighlight | null | undefined} highlight
 * @returns {string}
 */
export function factionTerritoryHighlightKey(highlight) {
  if (!highlight) return ''
  if (highlight.type === 'faction') return `faction:${highlight.factionId}`
  return `unaligned:${highlight.settlementId}`
}

/**
 * @param {import('../core/types.js').WorldDocument | null | undefined} worldDocument
 * @returns {{
 *   gridWidth: number,
 *   settlementIdByCell: (string | null)[],
 *   factionIdBySettlementId: Map<string, string | null>,
 *   settlements: object[],
 * } | null}
 */
export function buildFactionTerritoryHoverIndex(worldDocument) {
  const gridWidth = worldDocument?.gridWidth
  const gridHeight = worldDocument?.gridHeight
  if (!gridWidth || !gridHeight) return null

  const cellCount = gridWidth * gridHeight
  /** @type {(string | null)[]} */
  const settlementIdByCell = Array.from({ length: cellCount }, () => null)
  /** @type {Map<string, string | null>} */
  const factionIdBySettlementId = new Map()
  const primaryClaim = worldDocument.primaryClaim ?? {}
  const settlements = (worldDocument.settlements ?? []).filter(
    (s) => s && s.status !== 'ruin' && (s.population === undefined || s.population > 0),
  )

  for (const settlement of settlements) {
    if (typeof settlement.id !== 'string') continue
    const colored =
      settlement.factionId &&
      factionHasTerritoryColor(settlement.factionId, { settlements })
        ? settlement.factionId
        : null
    factionIdBySettlementId.set(settlement.id, colored)
    const cells = primaryClaim[settlement.id]
    if (!Array.isArray(cells)) continue
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue
      const x = Math.trunc(cell.x)
      const y = Math.trunc(cell.y)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
      if (!isHoverLandCell(worldDocument, x, y, gridWidth, gridHeight)) continue
      settlementIdByCell[y * gridWidth + x] = settlement.id
    }
  }

  return { gridWidth, settlementIdByCell, factionIdBySettlementId, settlements }
}

/**
 * @param {import('../core/types.js').WorldDocument | null | undefined} worldDocument
 * @param {number} worldX
 * @param {number} worldY
 * @param {ReturnType<typeof buildFactionTerritoryHoverIndex>} [index]
 * @returns {FactionTerritoryHighlight | null}
 */
export function hitTestFactionTerritoryHighlight(worldDocument, worldX, worldY, index) {
  const hoverIndex = index ?? buildFactionTerritoryHoverIndex(worldDocument)
  if (!hoverIndex) return null
  const { gridWidth, settlementIdByCell, factionIdBySettlementId } = hoverIndex
  const gridHeight = settlementIdByCell.length / gridWidth
  const x = Math.floor(worldX)
  const y = Math.floor(worldY)
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return null
  const settlementId = settlementIdByCell[y * gridWidth + x]
  if (!settlementId) return null
  const factionId = factionIdBySettlementId.get(settlementId)
  if (factionId) return { type: 'faction', factionId }
  return { type: 'unaligned', settlementId }
}

/**
 * @param {object} worldDocument
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function isHoverLandCell(worldDocument, x, y, gridWidth, gridHeight) {
  const index = y * gridWidth + x
  const elevation = worldDocument.fields?.elevation
  if (elevation && elevation.length === gridWidth * gridHeight && elevation[index] < SEA_LEVEL) {
    return false
  }
  if (worldDocument.lakeMask?.[index] === 1) return false
  if (worldDocument.riverCorridorMask?.[index] === 1) return false
  return true
}
