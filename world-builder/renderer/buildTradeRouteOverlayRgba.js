/**
 * Trade route inspect overlay: draws every candidate edge faintly (dormant) and edges
 * carrying realized flow strongly (active), tinted by transport mode. Candidates come
 * from geography; activation is decided by clearing. No embargo styling.
 * Domain: world-builder/CONTEXT.md — trade route, candidate route, active flow, transport mode.
 */

import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { densifyRouteCells } from '../core/colonization/expeditions/expeditionRouting.js'

/** Distinct per-mode tints (value 1 = overland, 2 = road, 3 = inland water, 4 = open sea). */
export const TRADE_ROUTE_OVERLAND_RGB = [176, 140, 92]
export const TRADE_ROUTE_ROAD_RGB = [142, 144, 148]
export const TRADE_ROUTE_INLAND_WATER_RGB = [40, 180, 190]
export const TRADE_ROUTE_OPEN_SEA_RGB = [20, 90, 180]

/** @type {Readonly<Record<number, number[]>>} */
export const TRADE_ROUTE_MODE_RGB_BY_VALUE = Object.freeze({
  1: TRADE_ROUTE_OVERLAND_RGB,
  2: TRADE_ROUTE_ROAD_RGB,
  3: TRADE_ROUTE_INLAND_WATER_RGB,
  4: TRADE_ROUTE_OPEN_SEA_RGB,
})

/** Faint alpha for dormant candidate edges with no realized flow. */
export const TRADE_ROUTE_DORMANT_ALPHA = 0.28

/** Strong alpha for edges carrying realized flow. */
export const TRADE_ROUTE_ACTIVE_ALPHA = 0.95

/**
 * @param {string | undefined} mode
 * @returns {number}
 */
export function tradeRouteModeValue(mode) {
  if (mode === 'openSea' || mode === 'open_sea') return 4
  if (mode === 'inlandWater' || mode === 'inland_sail' || mode === 'sail') return 3
  if (mode === 'road') return 2
  return 1
}

/**
 * @param {{
 *   activeFlows?: Array<{ edgeId?: string, amount?: number }>,
 * }} tradeRouteState
 * @param {import('../core/economy/tradeClearing/runTradeClearing.js').TradeClearingResult | null | undefined} result
 * @returns {Set<string>}
 */
function resolveActiveEdgeIds(tradeRouteState, result) {
  const flows =
    tradeRouteState?.activeFlows?.length ? tradeRouteState.activeFlows : (result?.flows ?? [])
  /** @type {Set<string>} */
  const active = new Set()
  for (const flow of flows) {
    if (flow && typeof flow.edgeId === 'string' && Math.abs(flow.amount ?? 0) > 0) {
      active.add(flow.edgeId)
    }
  }
  return active
}

/**
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   settlements?: Array<{ id: string, x?: number, y?: number }>,
 *   tradeRouteState?: import('../core/colonization/createDefaultColonizationSlice.js').TradeRouteState,
 *   lastTradeEpochResult?: import('../core/economy/tradeClearing/runTradeClearing.js').TradeClearingResult | null,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildTradeRouteOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const candidates = worldDocument.tradeRouteState?.candidates ?? []
  if (candidates.length === 0) {
    return null
  }

  /** @type {Map<string, { x: number, y: number }>} */
  const positionById = new Map()
  for (const settlement of worldDocument.settlements ?? []) {
    if (settlement && Number.isFinite(settlement.x) && Number.isFinite(settlement.y)) {
      positionById.set(settlement.id, {
        x: Math.trunc(settlement.x),
        y: Math.trunc(settlement.y),
      })
    }
  }

  const activeEdgeIds = resolveActiveEdgeIds(
    worldDocument.tradeRouteState,
    worldDocument.lastTradeEpochResult,
  )

  const cellCount = gridWidth * gridHeight
  const fillMode = new Uint8Array(cellCount)
  const fillActive = new Uint8Array(cellCount)
  let painted = false

  for (const edge of candidates) {
    const from = positionById.get(edge.fromSettlementId)
    const to = positionById.get(edge.toSettlementId)
    if (!from || !to) continue

    const modeValue = tradeRouteModeValue(edge.mode)
    const active = activeEdgeIds.has(edge.id)
    for (const cell of densifyRouteCells([from, to])) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= gridWidth || cell.y >= gridHeight) continue
      const index = cell.y * gridWidth + cell.x
      if (active) {
        fillMode[index] = modeValue
        fillActive[index] = 1
      } else if (fillMode[index] === 0) {
        fillMode[index] = modeValue
      }
      painted = true
    }
  }

  if (!painted) {
    return null
  }

  const rgba = new Uint8ClampedArray(cellCount * 4)
  const dormantAlphaByte = Math.round(TRADE_ROUTE_DORMANT_ALPHA * 255)
  const activeAlphaByte = Math.round(TRADE_ROUTE_ACTIVE_ALPHA * 255)
  for (let i = 0; i < cellCount; i += 1) {
    const modeValue = fillMode[i]
    if (!modeValue) continue
    const rgb = TRADE_ROUTE_MODE_RGB_BY_VALUE[modeValue]
    const offset = i * 4
    rgba[offset] = rgb[0]
    rgba[offset + 1] = rgb[1]
    rgba[offset + 2] = rgb[2]
    rgba[offset + 3] = fillActive[i] ? activeAlphaByte : dormantAlphaByte
  }
  return rgba
}

/**
 * @param {Parameters<typeof buildTradeRouteOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildTradeRouteOverlayCanvas(worldDocument) {
  const rgba = buildTradeRouteOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
