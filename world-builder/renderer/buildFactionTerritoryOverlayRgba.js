/**
 * Faction territory overlay: paints exclusive primary-claim hinterlands with one solid
 * color per faction. Unaligned settlements paint neutral gray.
 * Domain: world-builder/CONTEXT.md — Faction territory overlay; ADR 0018.
 */

import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { SEA_LEVEL } from '../core/biomeIds.js'

/**
 * Qualitative HSV slots for living factions. Hues are spaced to avoid a green pile-up
 * (one green, one teal); S/V also vary so near-hues stay distinct in RGB. Length 16 covers
 * a typical heavily colonized run; later slots reuse entries with extra S/V wraps.
 * Each entry: [hue°, saturation 0–1, value 0–1].
 */
export const FACTION_TERRITORY_PALETTE = Object.freeze([
  Object.freeze([205, 0.8, 0.8]), // blue
  Object.freeze([30, 0.85, 0.85]), // orange
  Object.freeze([275, 0.72, 0.74]), // purple
  Object.freeze([355, 0.8, 0.8]), // crimson
  Object.freeze([155, 0.75, 0.72]), // teal
  Object.freeze([315, 0.72, 0.8]), // magenta
  Object.freeze([55, 0.82, 0.84]), // gold
  Object.freeze([180, 0.72, 0.7]), // cyan
  Object.freeze([330, 0.74, 0.76]), // rose
  Object.freeze([120, 0.7, 0.64]), // green (single, dimmer)
  Object.freeze([240, 0.7, 0.72]), // indigo
  Object.freeze([10, 0.68, 0.66]), // brick red
  Object.freeze([205, 0.4, 0.92]), // light sky (blue second ring)
  Object.freeze([95, 0.5, 0.5]), // olive (not bright green)
  Object.freeze([275, 0.38, 0.9]), // lavender
  Object.freeze([45, 0.65, 0.48]), // brown-amber
])

/** Unaligned gray fill. */
export const FACTION_TERRITORY_UNALIGNED_RGB = Object.freeze([148, 148, 148])

/** Uniform stained-glass fill alpha for all territory cells. */
export const FACTION_TERRITORY_FILL_ALPHA = 0.72

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
 * Stable palette index for a faction: prefer emergence order across the roster (including
 * extinct) so living colors do not reshuffle when another faction dies; fall back to id hash.
 *
 * @param {string} factionId
 * @param {Array<{ id: string, emergedEpoch?: number }> | null | undefined} factions
 * @returns {number}
 */
export function factionTerritoryPaletteIndex(factionId, factions) {
  if (Array.isArray(factions) && factions.length > 0) {
    const roster = [...factions].sort((a, b) => {
      const ae = Number.isFinite(a.emergedEpoch) ? /** @type {number} */ (a.emergedEpoch) : 0
      const be = Number.isFinite(b.emergedEpoch) ? /** @type {number} */ (b.emergedEpoch) : 0
      if (ae !== be) return ae - be
      return String(a.id).localeCompare(String(b.id))
    })
    const index = roster.findIndex((f) => f && f.id === factionId)
    if (index >= 0) return index
  }
  let hash = 0
  for (let i = 0; i < factionId.length; i += 1) {
    hash = (hash * 31 + factionId.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Solid RGB for a faction id (no membership / loyalty shade variation).
 *
 * @param {string} factionId
 * @param {Array<{ id: string, emergedEpoch?: number }> | null | undefined} [factions]
 * @returns {number[]}
 */
export function factionTerritoryRgb(factionId, factions) {
  const index = factionTerritoryPaletteIndex(factionId, factions)
  const base = FACTION_TERRITORY_PALETTE[index % FACTION_TERRITORY_PALETTE.length]
  const wrap = Math.floor(index / FACTION_TERRITORY_PALETTE.length)
  const [hue, baseS, baseV] = base
  const s = Math.min(0.92, Math.max(0.28, baseS + (wrap % 3) * 0.08 - wrap * 0.02))
  const v = Math.min(0.94, Math.max(0.4, baseV + ((wrap + 1) % 3) * 0.06 - wrap * 0.03))
  return hsvToRgb(hue, s, v)
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

  const factionRoster = worldDocument.factions ?? []
  const primaryClaim = worldDocument.primaryClaim ?? {}
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  // Outline ownership is by faction (not settlement) so abutting same-faction claims
  // share one silhouette; unaligned settlements each keep their own key.
  const ownerByCell = new Int32Array(gridWidth * gridHeight)
  const outlineOwnerByFactionId = new Map()
  let paintedAny = false
  let nextOwnerKey = 0

  for (const settlement of settlements) {
    const cells = primaryClaim[settlement.id]
    if (!Array.isArray(cells) || cells.length === 0) continue
    const rgb = settlement.factionId
      ? factionTerritoryRgb(settlement.factionId, factionRoster)
      : [...FACTION_TERRITORY_UNALIGNED_RGB]
    const alphaByte = Math.round(FACTION_TERRITORY_FILL_ALPHA * 255)
    let ownerKey
    if (settlement.factionId) {
      ownerKey = outlineOwnerByFactionId.get(settlement.factionId)
      if (ownerKey == null) {
        nextOwnerKey += 1
        ownerKey = nextOwnerKey
        outlineOwnerByFactionId.set(settlement.factionId, ownerKey)
      }
    } else {
      nextOwnerKey += 1
      ownerKey = nextOwnerKey
    }
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
