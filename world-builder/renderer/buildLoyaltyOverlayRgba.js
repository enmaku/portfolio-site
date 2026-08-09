/**
 * Loyalty overlay: wealth-style primary-claim hinterland fill tinted by factional
 * control hue and banner-tenure saturation (gray ↔ faction color).
 * Domain: world-builder/CONTEXT.md — Loyalty overlay; Banner tenure; Factional control.
 */

import { SEA_LEVEL } from '../core/biomeIds.js'
import { normalizeMembershipHistory } from '../core/colonization/politics/bannerTenure/bannerTenure.js'
import { getBannerTenureTuning } from '../core/colonization/politics/bannerTenure/bannerTenureTuning.js'
import {
  factionHasTerritoryColorByControl,
  resolveFactionalController,
} from '../core/colonization/politics/softPower/factionalControl.js'
import {
  FACTION_TERRITORY_UNALIGNED_RGB,
  factionTerritoryRgb,
} from './buildFactionTerritoryOverlayRgba.js'
import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'

/** Stained-glass fill alpha (wealth / territory family). */
export const LOYALTY_OVERLAY_FILL_ALPHA = 0.72

/** Thin claim-boundary fringe so abutting hinterlands stay separable. */
export const LOYALTY_CLAIM_OUTLINE_RGBA = [0, 0, 0, Math.round(0.78 * 255)]

/**
 * @param {object | null | undefined} settlement
 * @param {string[] | null | undefined} history
 * @param {number} windowSize
 * @returns {number} 0..1
 */
export function loyaltyShareForSettlement(settlement, history, windowSize) {
  const sticky =
    settlement && typeof settlement.factionId === 'string' && settlement.factionId
      ? settlement.factionId
      : null
  if (!sticky) return 0
  const normalized = normalizeMembershipHistory(history, { windowSize })
  if (normalized.length === 0) return 0
  let count = 0
  for (const entry of normalized) {
    if (entry === sticky) count += 1
  }
  return count / windowSize
}

/**
 * @param {number[]} factionRgb
 * @param {number} loyalty 0..1
 * @returns {number[]}
 */
export function mixLoyaltyRgb(factionRgb, loyalty) {
  const t = Math.min(1, Math.max(0, loyalty))
  const gray = FACTION_TERRITORY_UNALIGNED_RGB
  return [
    Math.round(gray[0] + (factionRgb[0] - gray[0]) * t),
    Math.round(gray[1] + (factionRgb[1] - gray[1]) * t),
    Math.round(gray[2] + (factionRgb[2] - gray[2]) * t),
  ]
}

/**
 * @param {object} settlement
 * @param {{
 *   settlements?: object[] | null,
 *   factions?: object[] | null,
 *   softPowerPaintBySettlementId?: Record<string, string> | null,
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[]> | null,
 *   windowSize?: number,
 * }} opts
 * @returns {number[]}
 */
export function resolveSettlementLoyaltyRgb(settlement, opts) {
  const settlements = Array.isArray(opts.settlements) ? opts.settlements : []
  const factions = Array.isArray(opts.factions) ? opts.factions : []
  const controlOpts = {
    settlements,
    factions,
    softPowerPaintBySettlementId: opts.softPowerPaintBySettlementId ?? {},
  }
  const windowSize = Math.max(
    1,
    Math.floor(
      Number(opts.windowSize) > 0 ? Number(opts.windowSize) : getBannerTenureTuning().windowSize,
    ),
  )
  const controllerId = resolveFactionalController(settlement, controlOpts)
  const factionRgb =
    controllerId && factionHasTerritoryColorByControl(controllerId, controlOpts)
      ? factionTerritoryRgb(controllerId, factions)
      : [...FACTION_TERRITORY_UNALIGNED_RGB]
  const sticky =
    typeof settlement.factionId === 'string' && settlement.factionId ? settlement.factionId : null
  const loyalty =
    sticky && controllerId === sticky
      ? loyaltyShareForSettlement(
          settlement,
          opts.bannerMembershipHistoryBySettlementId?.[settlement.id],
          windowSize,
        )
      : 0
  return mixLoyaltyRgb(factionRgb, loyalty)
}

/**
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   fields?: { elevation?: Float32Array },
 *   lakeMask?: Uint8Array,
 *   riverCorridorMask?: Uint8Array,
 * }} worldDocument
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isLoyaltyOverlayLandCell(worldDocument, x, y) {
  const { gridWidth, gridHeight } = worldDocument
  const index = y * gridWidth + x
  const elevation = worldDocument.fields?.elevation
  if (elevation && elevation.length === gridWidth * gridHeight && elevation[index] < SEA_LEVEL) {
    return false
  }
  if (worldDocument.lakeMask?.[index] === 1) return false
  if (worldDocument.riverCorridorMask?.[index] === 1) return false
  return true
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} gridWidth
 * @param {{ x: number, y: number }} cell
 * @param {number[]} rgb
 * @param {number} alphaByte
 */
function paintLoyaltyClaimCell(rgba, gridWidth, cell, rgb, alphaByte) {
  const x = Math.trunc(cell.x)
  const y = Math.trunc(cell.y)
  const offset = (y * gridWidth + x) * 4
  rgba[offset] = rgb[0]
  rgba[offset + 1] = rgb[1]
  rgba[offset + 2] = rgb[2]
  rgba[offset + 3] = alphaByte
}

/**
 * @param {Int32Array} ownerByCell
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
function computeLoyaltyClaimOutlineMask(ownerByCell, gridWidth, gridHeight) {
  const cellCount = gridWidth * gridHeight
  const outline = new Uint8Array(cellCount)
  for (let idx = 0; idx < cellCount; idx += 1) {
    const owner = ownerByCell[idx]
    if (!owner) continue
    const x = idx % gridWidth
    const y = (idx / gridWidth) | 0
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const nIdx = ny * gridWidth + nx
      if (ownerByCell[nIdx] === owner) continue
      outline[nIdx] = 1
    }
  }
  return outline
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {Int32Array} ownerByCell
 * @param {Uint8Array} outline
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   fields?: { elevation?: Float32Array },
 *   lakeMask?: Uint8Array,
 *   riverCorridorMask?: Uint8Array,
 * }} worldDocument
 */
function paintLoyaltyClaimOutlines(rgba, ownerByCell, outline, worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const [r, g, b, a] = LOYALTY_CLAIM_OUTLINE_RGBA
  const cellCount = gridWidth * gridHeight
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!outline[idx]) continue
    const x = idx % gridWidth
    const y = (idx / gridWidth) | 0
    if (!ownerByCell[idx] && !isLoyaltyOverlayLandCell(worldDocument, x, y)) continue
    const offset = idx * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildLoyaltyOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const settlements = Array.isArray(worldDocument.settlements) ? worldDocument.settlements : []
  const primaryClaim = worldDocument.primaryClaim ?? {}
  const paintOpts = {
    settlements,
    factions: worldDocument.factions,
    softPowerPaintBySettlementId: worldDocument.softPowerPaintBySettlementId,
    bannerMembershipHistoryBySettlementId: worldDocument.bannerMembershipHistoryBySettlementId,
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const ownerByCell = new Int32Array(gridWidth * gridHeight)
  const alphaByte = Math.round(LOYALTY_OVERLAY_FILL_ALPHA * 255)
  let paintedAny = false
  let ownerKey = 0

  for (const settlement of settlements) {
    if (!settlement || settlement.status === 'ruin' || typeof settlement.id !== 'string') continue
    const cells = primaryClaim[settlement.id]
    if (!Array.isArray(cells) || cells.length === 0) continue
    const rgb = resolveSettlementLoyaltyRgb(settlement, paintOpts)
    ownerKey += 1
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue
      const x = Math.trunc(cell.x)
      const y = Math.trunc(cell.y)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
      if (!isLoyaltyOverlayLandCell(worldDocument, x, y)) continue
      paintLoyaltyClaimCell(rgba, gridWidth, cell, rgb, alphaByte)
      ownerByCell[y * gridWidth + x] = ownerKey
      paintedAny = true
    }
  }

  if (!paintedAny) {
    return null
  }

  const outline = computeLoyaltyClaimOutlineMask(ownerByCell, gridWidth, gridHeight)
  paintLoyaltyClaimOutlines(rgba, ownerByCell, outline, worldDocument)
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildLoyaltyOverlayCanvas(worldDocument) {
  const rgba = buildLoyaltyOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
