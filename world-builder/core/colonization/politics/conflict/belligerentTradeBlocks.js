/**
 * Belligerent on-map trade blocks between major-war sides.
 * Domain: world-builder/CONTEXT.md — Conflict engine; ADR 0020.
 */

import { BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS } from './conflictConstants.js'
import { HISTORY_KIND_TREATY_PEACE } from '../historyKinds.js'

/**
 * @typedef {{
 *   aFactionId: string,
 *   bFactionId: string,
 *   openedEpoch: number,
 *   peaceEligibleEpoch: number,
 * }} BelligerentTradeBlock
 */

/**
 * @param {{
 *   slice: object,
 *   aFactionId: string,
 *   bFactionId: string,
 *   epoch: number,
 * }} params
 * @returns {object}
 */
export function openBelligerentTradeBlock(params) {
  const a = params.aFactionId
  const b = params.bFactionId
  if (!a || !b || a === b) {
    return {
      ...params.slice,
      belligerentTradeBlocks: [...(params.slice.belligerentTradeBlocks ?? [])],
    }
  }

  const blocks = [...(params.slice.belligerentTradeBlocks ?? [])]
  if (areBelligerentFactions(blocks, a, b, params.epoch)) {
    return { ...params.slice, belligerentTradeBlocks: blocks }
  }

  /** @type {BelligerentTradeBlock} */
  const block = {
    aFactionId: a < b ? a : b,
    bFactionId: a < b ? b : a,
    openedEpoch: params.epoch,
    peaceEligibleEpoch: params.epoch + BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS,
  }
  blocks.push(block)
  return { ...params.slice, belligerentTradeBlocks: blocks }
}

/**
 * Clear blocks whose peaceEligibleEpoch has been reached (treaty/peace).
 *
 * @param {{ slice: object, epoch: number }} params
 * @returns {object}
 */
export function clearEligibleBelligerentTradeBlocks(params) {
  const blocks = (params.slice.belligerentTradeBlocks ?? []).filter(
    (block) => params.epoch < block.peaceEligibleEpoch,
  )
  /** @type {object[]} */
  const events = []
  for (const block of params.slice.belligerentTradeBlocks ?? []) {
    if (params.epoch >= block.peaceEligibleEpoch) {
      events.push({
        kind: HISTORY_KIND_TREATY_PEACE,
        epoch: params.epoch,
        aFactionId: block.aFactionId,
        bFactionId: block.bFactionId,
      })
    }
  }
  return {
    ...params.slice,
    belligerentTradeBlocks: blocks,
    ...(events.length
      ? { historyLog: [...(params.slice.historyLog ?? []), ...events] }
      : {}),
  }
}

/**
 * @param {BelligerentTradeBlock[] | null | undefined} blocks
 * @param {string} aFactionId
 * @param {string} bFactionId
 * @returns {boolean}
 */
export function areBelligerentFactions(blocks, aFactionId, bFactionId) {
  if (!aFactionId || !bFactionId || aFactionId === bFactionId) return false
  const lo = aFactionId < bFactionId ? aFactionId : bFactionId
  const hi = aFactionId < bFactionId ? bFactionId : aFactionId
  return (blocks ?? []).some((block) => block.aFactionId === lo && block.bFactionId === hi)
}

/**
 * True when on-map trade between two settlements should be blocked.
 *
 * @param {{
 *   blocks: BelligerentTradeBlock[] | null | undefined,
 *   factionIdA: string | null | undefined,
 *   factionIdB: string | null | undefined,
 * }} params
 * @returns {boolean}
 */
export function isOnMapTradeBlockedBetween(params) {
  return areBelligerentFactions(params.blocks, params.factionIdA, params.factionIdB)
}

/**
 * Drop candidate edges whose endpoints belong to currently belligerent factions.
 * Geography candidates remain on the slice; clearing uses the filtered graph.
 *
 * @param {{
 *   edges: import('../../../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge[],
 *   blocks: BelligerentTradeBlock[] | null | undefined,
 *   factionIdBySettlementId: Record<string, string | null | undefined>,
 * }} params
 * @returns {import('../../../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge[]}
 */
export function filterCandidateEdgesForBelligerents(params) {
  const blocks = params.blocks ?? []
  if (!blocks.length) return [...(params.edges ?? [])]
  const factionById = params.factionIdBySettlementId ?? {}
  return (params.edges ?? []).filter((edge) => {
    const a = factionById[edge.fromSettlementId]
    const b = factionById[edge.toSettlementId]
    return !areBelligerentFactions(blocks, a, b)
  })
}
