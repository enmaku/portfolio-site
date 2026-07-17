/**
 * Wealth inspect overlay: paints each living settlement's primary-claim hinterland by
 * net wealth (realm balance plus port off-map credit) normalized against the shared
 * projected-income denominator that also sets the credit limit. Settlements with zero
 * projected income cannot be normalized, so any standing wealth reads at full saturation.
 * Paint is masked to dry land (not ocean, lake, or river corridor).
 * Domain: world-builder/CONTEXT.md — wealth overlay, credit limit, realm balance.
 */

import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { projectedAnnualIncomeCp } from '../core/economy/ledgers/creditLimit.js'
import { SEA_LEVEL } from '../core/biomeIds.js'

/** Surplus (positive net wealth) tint. */
export const WEALTH_SURPLUS_RGB = [46, 160, 67]

/** Deficit (negative net wealth) tint. */
export const WEALTH_DEFICIT_RGB = [218, 54, 51]

/** Neutral (zero net wealth) tint. */
export const WEALTH_NEUTRAL_RGB = [148, 150, 154]

export const WEALTH_OVERLAY_MIN_ALPHA = 0.08
export const WEALTH_OVERLAY_MAX_ALPHA = 0.5

/**
 * @typedef {Object} SettlementWealthSignal
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} balanceCp
 * @property {number} externalClaimCp
 * @property {number} netWealthCp
 * @property {number} projectedIncomeCp Shared credit-limit denominator.
 * @property {boolean} zeroIncome
 * @property {number} normalized netWealth / projectedIncome, clamped to [-1, 1]; sign only when zero income.
 */

/**
 * Gross realized export + toll receipts per settlement from the last clearing, used as
 * the prior-income component of the shared projected-income denominator.
 *
 * @param {import('../core/economy/tradeClearing/runTradeClearing.js').TradeClearingResult | null | undefined} result
 * @returns {Record<string, number>}
 */
function realizedIncomeBySettlement(result) {
  /** @type {Record<string, number>} */
  const income = {}
  for (const delta of result?.obligationDeltas ?? []) {
    if (!delta || typeof delta.toSettlementId !== 'string') continue
    income[delta.toSettlementId] = (income[delta.toSettlementId] ?? 0) + Math.max(0, delta.amountCp ?? 0)
  }
  return income
}

/**
 * @param {{
 *   settlements?: Array<{ id: string, x?: number, y?: number }>,
 *   lastTradeEpochResult?: import('../core/economy/tradeClearing/runTradeClearing.js').TradeClearingResult | null,
 *   externalTradeAccounts?: Record<string, number>,
 * }} worldDocument
 * @returns {SettlementWealthSignal[]}
 */
export function computeSettlementWealthSignals(worldDocument) {
  const settlements = worldDocument?.settlements ?? []
  const result = worldDocument?.lastTradeEpochResult ?? null
  const external = worldDocument?.externalTradeAccounts ?? {}
  const incomeById = realizedIncomeBySettlement(result)

  /** @type {SettlementWealthSignal[]} */
  const signals = []
  for (const settlement of settlements) {
    if (!settlement || !Number.isFinite(settlement.x) || !Number.isFinite(settlement.y)) continue
    const balanceCp = result?.realmBalancesCp?.[settlement.id] ?? 0
    const externalClaimCp = external[settlement.id] ?? 0
    const netWealthCp = balanceCp + externalClaimCp
    const projectedIncomeCp = projectedAnnualIncomeCp({
      priorRealizedNetExportTollIncomeCp: incomeById[settlement.id] ?? 0,
      exportableSurplusAfterSurvivalReservationCp: 0,
    })
    const zeroIncome = !(projectedIncomeCp > 0)
    const normalized = zeroIncome
      ? Math.sign(netWealthCp)
      : Math.max(-1, Math.min(1, netWealthCp / projectedIncomeCp))
    signals.push({
      id: settlement.id,
      x: Math.trunc(settlement.x),
      y: Math.trunc(settlement.y),
      balanceCp,
      externalClaimCp,
      netWealthCp,
      projectedIncomeCp,
      zeroIncome,
      normalized,
    })
  }
  return signals
}

/**
 * @param {number} normalized
 * @returns {number[]}
 */
function wealthCellRgb(normalized) {
  if (normalized > 0) return WEALTH_SURPLUS_RGB
  if (normalized < 0) return WEALTH_DEFICIT_RGB
  return WEALTH_NEUTRAL_RGB
}

/**
 * @param {SettlementWealthSignal} signal
 * @returns {number}
 */
function wealthCellAlpha(signal) {
  const magnitude = Math.min(1, Math.abs(signal.normalized))
  return WEALTH_OVERLAY_MIN_ALPHA + (WEALTH_OVERLAY_MAX_ALPHA - WEALTH_OVERLAY_MIN_ALPHA) * magnitude
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
  let paintedAny = false
  for (const signal of signals) {
    if (statusById.get(signal.id) === 'ruin') continue
    const cells = primaryClaim[signal.id]
    if (!Array.isArray(cells) || cells.length === 0) continue
    const rgb = wealthCellRgb(signal.normalized)
    const alphaByte = Math.round(wealthCellAlpha(signal) * 255)
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue
      const x = Math.trunc(cell.x)
      const y = Math.trunc(cell.y)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
      if (!isWealthOverlayLandCell(worldDocument, x, y)) continue
      paintWealthClaimCell(rgba, gridWidth, gridHeight, cell, rgb, alphaByte)
      paintedAny = true
    }
  }
  return paintedAny ? rgba : null
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
