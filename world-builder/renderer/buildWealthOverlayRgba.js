/**
 * Wealth inspect overlay: paints each living settlement's primary-claim hinterland by the
 * same combined balance as the settlement trade tooltip (realm balance plus port off-map
 * credit). Tint uses an HSB mix-in-black ramp (bright lime/scarlet → deep hunter/deep red)
 * with a high stained-glass alpha floor. Magnitude scales with that balance, rescaled so
 * the living extreme on the map hits full tint.
 * Paint is masked to dry land (not ocean, lake, or river).
 * Domain: world-builder/CONTEXT.md — wealth overlay, realm balance.
 */

import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { SEA_LEVEL } from '../core/biomeIds.js'
import { computeSettlementWealthSignals } from '../core/economy/computeSettlementWealthSignals.js'

/** Surplus hue (°): lime → hunter green family. */
export const WEALTH_SURPLUS_HUE = 118

/** Deficit hue (°). */
export const WEALTH_DEFICIT_HUE = 4

/** Saturation at near-zero magnitude (still vivid stained-glass). */
export const WEALTH_SAT_MIN = 0.78

/** Saturation at full magnitude. */
export const WEALTH_SAT_MAX = 0.96

/** Brightness at near-zero magnitude (bright lime / bright red). */
export const WEALTH_VALUE_MAX = 0.94

/** Brightness at full magnitude (mix-in-black hunter / deep red). */
export const WEALTH_VALUE_MIN = 0.26

/**
 * Zero net wealth tint — amber/orange for marginal settlements barely clearing,
 * not a calm gray “neutral.”
 */
export const WEALTH_NEUTRAL_RGB = [236, 148, 52]

/** Stained-glass fill: high floor so shade, not wash, carries magnitude. */
export const WEALTH_OVERLAY_MIN_ALPHA = 0.58
export const WEALTH_OVERLAY_MAX_ALPHA = 0.82

/** Thin claim-boundary fringe so adjacent similar-wealth hinterlands stay separable. */
export const WEALTH_CLAIM_OUTLINE_RGBA = [0, 0, 0, Math.round(0.78 * 255)]

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
 * Stained-glass surplus/debt tint: fixed hue, rising saturation, falling brightness
 * (HSB mix-in-black) along a sqrt magnitude curve — lime→hunter / bright red→deep red.
 *
 * @param {number} normalized
 * @returns {number[]}
 */
export function wealthTintRgb(normalized) {
  if (!(normalized > 0) && !(normalized < 0)) return WEALTH_NEUTRAL_RGB
  const t = Math.sqrt(Math.min(1, Math.abs(normalized)))
  const hue = normalized > 0 ? WEALTH_SURPLUS_HUE : WEALTH_DEFICIT_HUE
  const s = WEALTH_SAT_MIN + (WEALTH_SAT_MAX - WEALTH_SAT_MIN) * t
  const v = WEALTH_VALUE_MAX + (WEALTH_VALUE_MIN - WEALTH_VALUE_MAX) * t
  return hsvToRgb(hue, s, v)
}

/** Dark-end surplus RGB (full magnitude). */
export const WEALTH_SURPLUS_RGB = wealthTintRgb(1)

/** Dark-end deficit RGB (full magnitude). */
export const WEALTH_DEFICIT_RGB = wealthTintRgb(-1)

/**
 * @typedef {import('../core/economy/computeSettlementWealthSignals.js').SettlementWealthSignal} SettlementWealthSignal
 */

/**
 * @param {SettlementWealthSignal} signal
 * @returns {number}
 */
function wealthCellAlpha(signal) {
  const magnitude = Math.min(1, Math.abs(signal.normalized))
  const curved = Math.sqrt(magnitude)
  return WEALTH_OVERLAY_MIN_ALPHA + (WEALTH_OVERLAY_MAX_ALPHA - WEALTH_OVERLAY_MIN_ALPHA) * curved
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {{ x: number, y: number }} cell
 * @param {number[]} rgb
 * @param {number} alphaByte
 */
function paintWealthClaimCell(rgba, gridWidth, gridHeight, cell, rgb, alphaByte) {
  const x = Math.trunc(cell.x)
  const y = Math.trunc(cell.y)
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return
  const offset = (y * gridWidth + x) * 4
  rgba[offset] = rgb[0]
  rgba[offset + 1] = rgb[1]
  rgba[offset + 2] = rgb[2]
  rgba[offset + 3] = alphaByte
}

/**
 * One-cell exterior ring around each painted claim: unclaimed dry neighbors, plus the
 * facing edge cell of a different settlement so shared hinterland borders stay readable.
 *
 * @param {Int32Array} ownerByCell 0 = unclaimed; positive = settlement owner key
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
function computeWealthClaimOutlineMask(ownerByCell, gridWidth, gridHeight) {
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
function paintWealthClaimOutlines(rgba, ownerByCell, outline, worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const [r, g, b, a] = WEALTH_CLAIM_OUTLINE_RGBA
  const cellCount = gridWidth * gridHeight
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!outline[idx]) continue
    const x = idx % gridWidth
    const y = (idx / gridWidth) | 0
    if (!ownerByCell[idx] && !isWealthOverlayLandCell(worldDocument, x, y)) continue
    const offset = idx * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }
}

/**
 * Land-only paint gate: above sea level and not lake/river. Does not use the closed-island
 * rim ocean force from expedition masks — claim cells on the map edge stay paintable when dry.
 *
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
function isWealthOverlayLandCell(worldDocument, x, y) {
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
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   settlements?: Array<{ id: string, x?: number, y?: number, status?: string }>,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   fields?: { elevation?: Float32Array },
 *   lakeMask?: Uint8Array,
 *   riverCorridorMask?: Uint8Array,
 *   lastTradeEpochResult?: import('../core/economy/tradeClearing/runTradeClearing.js').TradeClearingResult | null,
 *   tradeAccounts?: import('../core/economy/ledgers/bilateralObligations.js').TradeAccountsState,
 *   balancesBySettlementId?: Record<string, number>,
 *   externalTradeAccounts?: Record<string, number>,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildWealthOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const signals = computeSettlementWealthSignals(worldDocument)
  if (signals.length === 0) {
    return null
  }

  const statusById = new Map(
    (worldDocument.settlements ?? []).map((settlement) => [settlement.id, settlement.status]),
  )
  const primaryClaim = worldDocument.primaryClaim ?? {}
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const ownerByCell = new Int32Array(gridWidth * gridHeight)
  let paintedAny = false
  let ownerKey = 0
  for (const signal of signals) {
    if (statusById.get(signal.id) === 'ruin') continue
    const cells = primaryClaim[signal.id]
    if (!Array.isArray(cells) || cells.length === 0) continue
    ownerKey += 1
    const rgb = wealthTintRgb(signal.normalized)
    const alphaByte = Math.round(wealthCellAlpha(signal) * 255)
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue
      const x = Math.trunc(cell.x)
      const y = Math.trunc(cell.y)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
      if (!isWealthOverlayLandCell(worldDocument, x, y)) continue
      paintWealthClaimCell(rgba, gridWidth, gridHeight, cell, rgb, alphaByte)
      ownerByCell[y * gridWidth + x] = ownerKey
      paintedAny = true
    }
  }
  if (!paintedAny) {
    return null
  }
  const outline = computeWealthClaimOutlineMask(ownerByCell, gridWidth, gridHeight)
  paintWealthClaimOutlines(rgba, ownerByCell, outline, worldDocument)
  return rgba
}

/**
 * @param {Parameters<typeof buildWealthOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildWealthOverlayCanvas(worldDocument) {
  const rgba = buildWealthOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
