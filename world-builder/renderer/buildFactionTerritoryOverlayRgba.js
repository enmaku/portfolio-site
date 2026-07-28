/**
 * Faction territory overlay: paints exclusive primary-claim hinterlands by faction hue
 * with hybrid control-strength opacity. Unaligned settlements paint neutral gray.
 * Domain: world-builder/CONTEXT.md — Faction territory overlay; ADR 0018.
 */

import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { SEA_LEVEL } from '../core/biomeIds.js'

/** Distinct hues for living factions (degrees). */
export const FACTION_TERRITORY_HUES = Object.freeze([210, 12, 140, 280, 45, 320, 175, 85])

/** Unaligned gray fill. */
export const FACTION_TERRITORY_UNALIGNED_RGB = Object.freeze([148, 148, 148])

export const FACTION_TERRITORY_CAPITAL_ALPHA = 0.82
export const FACTION_TERRITORY_MEMBER_ALPHA = 0.72
export const FACTION_TERRITORY_VASSAL_ALPHA = 0.55
export const FACTION_TERRITORY_UNALIGNED_ALPHA = 0.48

export const FACTION_TERRITORY_CLAIM_OUTLINE_RGBA = [0, 0, 0, Math.round(0.78 * 255)]

/**
 * @param {number} h degrees
 * @param {number} s 0–1
 * @param {number} v 0–1
 * @returns {number[]}
 */
function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * Stable hue for a faction id.
 *
 * @param {string} factionId
 * @returns {number[]}
 */
export function factionTerritoryRgb(factionId) {
  let hash = 0
  for (let i = 0; i < factionId.length; i += 1) {
    hash = (hash * 31 + factionId.charCodeAt(i)) >>> 0
  }
  const hue = FACTION_TERRITORY_HUES[hash % FACTION_TERRITORY_HUES.length]
  return hsvToRgb(hue, 0.72, 0.78)
}

/**
 * @param {object} settlement
 * @param {object | undefined} faction
 * @returns {number}
 */
export function factionTerritoryControlAlpha(settlement, faction) {
  if (!settlement?.factionId) return FACTION_TERRITORY_UNALIGNED_ALPHA
  if (faction && faction.capitalSettlementId === settlement.id) {
    return FACTION_TERRITORY_CAPITAL_ALPHA
  }
  if (settlement.vassalLiegeSettlementId) return FACTION_TERRITORY_VASSAL_ALPHA
  return FACTION_TERRITORY_MEMBER_ALPHA
}

/**
 * @param {object} worldDocument
 * @param {number} x
 * @param {number} y
 */
function isFactionTerritoryLandCell(worldDocument, x, y) {
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
function paintCell(rgba, gridWidth, cell, rgb, alphaByte) {
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
 */
function computeOutlineMask(ownerByCell, gridWidth, gridHeight) {
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
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   settlements?: object[],
 *   factions?: object[],
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   fields?: { elevation?: Float32Array },
 *   lakeMask?: Uint8Array,
 *   riverCorridorMask?: Uint8Array,
 *   colonizationPhase?: string,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildFactionTerritoryOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) return null
  // Paint once any faction membership exists (founding faction at begin) or after latch.
  const hasMembership =
    worldDocument.increment3LatchedEpoch != null ||
    (Array.isArray(worldDocument.factions) &&
      worldDocument.factions.some((f) => f && f.status === 'active')) ||
    (Array.isArray(worldDocument.settlements) &&
      worldDocument.settlements.some((s) => s && s.factionId))
  if (!hasMembership) return null

  const settlements = (worldDocument.settlements ?? []).filter(
    (s) => s && s.status !== 'ruin' && (s.population === undefined || s.population > 0),
  )
  if (settlements.length === 0) return null

  const factionsById = new Map(
    (worldDocument.factions ?? [])
      .filter((f) => f && f.status === 'active')
      .map((f) => [f.id, f]),
  )
  const primaryClaim = worldDocument.primaryClaim ?? {}
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const ownerByCell = new Int32Array(gridWidth * gridHeight)
  let paintedAny = false
  let ownerKey = 0

  for (const settlement of settlements) {
    const cells = primaryClaim[settlement.id]
    if (!Array.isArray(cells) || cells.length === 0) continue
    const faction = settlement.factionId ? factionsById.get(settlement.factionId) : null
    const rgb = settlement.factionId
      ? factionTerritoryRgb(settlement.factionId)
      : [...FACTION_TERRITORY_UNALIGNED_RGB]
    const alphaByte = Math.round(factionTerritoryControlAlpha(settlement, faction) * 255)
    ownerKey += 1
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue
      const x = Math.trunc(cell.x)
      const y = Math.trunc(cell.y)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
      if (!isFactionTerritoryLandCell(worldDocument, x, y)) continue
      paintCell(rgba, gridWidth, cell, rgb, alphaByte)
      ownerByCell[y * gridWidth + x] = ownerKey
      paintedAny = true
    }
  }

  if (!paintedAny) return null

  const outline = computeOutlineMask(ownerByCell, gridWidth, gridHeight)
  const [or, og, ob, oa] = FACTION_TERRITORY_CLAIM_OUTLINE_RGBA
  for (let idx = 0; idx < outline.length; idx += 1) {
    if (!outline[idx]) continue
    const x = idx % gridWidth
    const y = (idx / gridWidth) | 0
    if (!ownerByCell[idx] && !isFactionTerritoryLandCell(worldDocument, x, y)) continue
    const offset = idx * 4
    rgba[offset] = or
    rgba[offset + 1] = og
    rgba[offset + 2] = ob
    rgba[offset + 3] = oa
  }

  return rgba
}

/**
 * @param {Parameters<typeof buildFactionTerritoryOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildFactionTerritoryOverlayCanvas(worldDocument) {
  const rgba = buildFactionTerritoryOverlayRgba(worldDocument)
  if (!rgba) return null
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
