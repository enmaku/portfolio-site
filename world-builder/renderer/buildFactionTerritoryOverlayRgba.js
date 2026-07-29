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
import {
  factionHasTerritoryColor,
} from '../core/colonization/politics/factionCap.js'
import { MAX_ACTIVE_FACTIONS } from '../core/colonization/politics/politicsConstants.js'

/**
 * ColorBrewer qualitative Set3 (12 classes) — source RGB before baseline sat bump.
 * Active roster is capped at this length; palette index is assigned at mint.
 * Source: https://colorbrewer2.org/?type=qualitative&scheme=Set3&n=12
 */
const COLORBREWER_SET3_RGB = Object.freeze([
  Object.freeze([0x8d, 0xd3, 0xc7]),
  Object.freeze([0xff, 0xff, 0xb3]),
  Object.freeze([0xbe, 0xba, 0xda]),
  Object.freeze([0xfb, 0x80, 0x72]),
  Object.freeze([0x80, 0xb1, 0xd3]),
  Object.freeze([0xfd, 0xb4, 0x62]),
  Object.freeze([0xb3, 0xde, 0x69]),
  Object.freeze([0xfc, 0xcd, 0xe5]),
  Object.freeze([0xd9, 0xd9, 0xd9]),
  Object.freeze([0xbc, 0x80, 0xbd]),
  Object.freeze([0xcc, 0xeb, 0xc5]),
  Object.freeze([0xff, 0xed, 0x6f]),
])

/** Modest chroma lift so Set3 reads through stained-glass alpha (below hover boost). */
export const FACTION_TERRITORY_BASELINE_SATURATION_BOOST = 0.18

/** Saturation added on hover (clearly above baseline). */
export const FACTION_TERRITORY_HOVER_SATURATION_BOOST = 0.42

/** Near-gray fills (unaligned / Set3 gray) darken slightly on hover — no chroma to boost. */
export const FACTION_TERRITORY_HOVER_GRAY_DARKEN = 0.18

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
 * @param {number[]} rgb
 * @returns {[number, number, number]} hue°, s 0–1, v 0–1
 */
function rgbToHsv(rgb) {
  const r = rgb[0] / 255
  const g = rgb[1] / 255
  const b = rgb[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360
  const s = max === 0 ? 0 : delta / max
  return [h, s, max]
}

/**
 * @param {number[]} rgb
 * @param {number} saturationBoost
 * @returns {number[]}
 */
function boostRgbSaturation(rgb, saturationBoost) {
  const [h, s, v] = rgbToHsv(rgb)
  if (s < 0.06) return [rgb[0], rgb[1], rgb[2]]
  const boost = Math.min(1, Math.max(0, saturationBoost))
  return hsvToRgb(h, Math.min(1, s + boost), v)
}

/**
 * Display palette: ColorBrewer Set3 with a light baseline saturation bump.
 */
export const FACTION_TERRITORY_PALETTE = Object.freeze(
  COLORBREWER_SET3_RGB.map((rgb) =>
    Object.freeze(boostRgbSaturation(rgb, FACTION_TERRITORY_BASELINE_SATURATION_BOOST)),
  ),
)

/**
 * Hover highlight: raise saturation further. Near-gray (unaligned) darkens a little
 * instead, since there is no hue chroma to boost.
 *
 * @param {number[]} rgb
 * @param {number} [saturationBoost]
 * @returns {number[]}
 */
export function saturateFactionTerritoryRgb(
  rgb,
  saturationBoost = FACTION_TERRITORY_HOVER_SATURATION_BOOST,
) {
  const [, s] = rgbToHsv(rgb)
  if (s < 0.06) {
    const t = Math.min(1, Math.max(0, FACTION_TERRITORY_HOVER_GRAY_DARKEN))
    return [
      Math.max(0, Math.round(rgb[0] * (1 - t))),
      Math.max(0, Math.round(rgb[1] * (1 - t))),
      Math.max(0, Math.round(rgb[2] * (1 - t))),
    ]
  }
  return boostRgbSaturation(rgb, saturationBoost)
}

/**
 * Stable palette index for a faction: prefer stored mint slot, then emergence order
 * across the roster (including extinct); fall back to id hash.
 *
 * @param {string} factionId
 * @param {Array<{ id: string, emergedEpoch?: number, territoryPaletteIndex?: number }> | null | undefined} factions
 * @returns {number}
 */
export function factionTerritoryPaletteIndex(factionId, factions) {
  if (Array.isArray(factions) && factions.length > 0) {
    const stored = factions.find((f) => f && f.id === factionId)
    if (
      stored &&
      Number.isInteger(stored.territoryPaletteIndex) &&
      /** @type {number} */ (stored.territoryPaletteIndex) >= 0 &&
      /** @type {number} */ (stored.territoryPaletteIndex) < MAX_ACTIVE_FACTIONS
    ) {
      return /** @type {number} */ (stored.territoryPaletteIndex)
    }
    const roster = [...factions].sort((a, b) => {
      const ae = Number.isFinite(a.emergedEpoch) ? /** @type {number} */ (a.emergedEpoch) : 0
      const be = Number.isFinite(b.emergedEpoch) ? /** @type {number} */ (b.emergedEpoch) : 0
      if (ae !== be) return ae - be
      return String(a.id).localeCompare(String(b.id))
    })
    const index = roster.findIndex((f) => f && f.id === factionId)
    if (index >= 0) return index % FACTION_TERRITORY_PALETTE.length
  }
  let hash = 0
  for (let i = 0; i < factionId.length; i += 1) {
    hash = (hash * 31 + factionId.charCodeAt(i)) >>> 0
  }
  return hash % FACTION_TERRITORY_PALETTE.length
}

/**
 * Solid RGB for a faction id (no membership / loyalty shade variation).
 *
 * @param {string} factionId
 * @param {Array<{ id: string, emergedEpoch?: number, territoryPaletteIndex?: number }> | null | undefined} [factions]
 * @returns {number[]}
 */
export function factionTerritoryRgb(factionId, factions) {
  const index = factionTerritoryPaletteIndex(factionId, factions)
  const rgb = FACTION_TERRITORY_PALETTE[index % FACTION_TERRITORY_PALETTE.length]
  return [rgb[0], rgb[1], rgb[2]]
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
 * @typedef {{ type: 'faction', factionId: string } | { type: 'unaligned', settlementId: string }} FactionTerritoryHighlight
 */

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
 * @param {{ highlight?: FactionTerritoryHighlight | null }} [options]
 * @returns {Uint8ClampedArray | null}
 */
export function buildFactionTerritoryOverlayRgba(worldDocument, options = {}) {
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

  const highlight = options.highlight ?? null
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
    const coloredFactionId =
      settlement.factionId &&
      factionHasTerritoryColor(settlement.factionId, { settlements })
        ? settlement.factionId
        : null
    let rgb = coloredFactionId
      ? factionTerritoryRgb(coloredFactionId, factionRoster)
      : [...FACTION_TERRITORY_UNALIGNED_RGB]
    if (settlementMatchesTerritoryHighlight(settlement, highlight, settlements)) {
      rgb = saturateFactionTerritoryRgb(rgb)
    }
    const alphaByte = Math.round(FACTION_TERRITORY_FILL_ALPHA * 255)
    let ownerKey
    if (coloredFactionId) {
      ownerKey = outlineOwnerByFactionId.get(coloredFactionId)
      if (ownerKey == null) {
        nextOwnerKey += 1
        ownerKey = nextOwnerKey
        outlineOwnerByFactionId.set(coloredFactionId, ownerKey)
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
 * @param {object} settlement
 * @param {FactionTerritoryHighlight | null | undefined} highlight
 * @param {object[] | null | undefined} [settlements]
 * @returns {boolean}
 */
export function settlementMatchesTerritoryHighlight(settlement, highlight, settlements) {
  if (!highlight || !settlement) return false
  const coloredFactionId =
    settlement.factionId &&
    factionHasTerritoryColor(settlement.factionId, {
      settlements: settlements ?? [settlement],
    })
      ? settlement.factionId
      : null
  if (highlight.type === 'faction') {
    return Boolean(coloredFactionId) && coloredFactionId === highlight.factionId
  }
  if (highlight.type === 'unaligned') {
    return !coloredFactionId && settlement.id === highlight.settlementId
  }
  return false
}

/**
 * @param {Parameters<typeof buildFactionTerritoryOverlayRgba>[0]} worldDocument
 * @param {{ highlight?: FactionTerritoryHighlight | null }} [options]
 * @returns {HTMLCanvasElement | null}
 */
export function buildFactionTerritoryOverlayCanvas(worldDocument, options = {}) {
  const rgba = buildFactionTerritoryOverlayRgba(worldDocument, options)
  if (!rgba) return null
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
