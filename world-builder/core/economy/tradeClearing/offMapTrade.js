/**
 * Residual off-map trade against the unseen world.
 * Domain: world-builder/CONTEXT.md — off-map trade, off-map shipping cost, external
 * trade account, port toll, transshipment.
 */

import { COMMODITY_IDS, cargoLbPerUnit, referencePriceCp } from '../commodityCatalog.js'
import { FISH_CURING_SALT_PER_FISH_LB } from '../productionAccounting.js'
import { offMapCargoCapacityLb } from '../tradeGraph/routeEconomics.js'
import {
  PROSPERITY_COMMODITIES,
  comfortFoodDemandLb,
  prosperityDemandUnits,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
} from './allocationTiers.js'
import { findMinCostPath } from './pathSearch.js'
import { creditRoomCpForImport, offMapImportResourceKind } from '../ledgers/creditRoom.js'

const EPSILON = 1e-6
/** Baseline port toll: 5% (mirrors runTradeClearing.PORT_TOLL_RATE without a cycle). */
const PORT_TOLL_RATE = 0.05

/** Residual overseas dump earns this fraction of reference price. */
export const OFF_MAP_EXPORT_PRICE_FACTOR = 0.5
/** Last-line overseas imports cost this multiple of reference (above local-price ceiling). */
export const OFF_MAP_IMPORT_PRICE_FACTOR = 2.5

/**
 * @param {{
 *   referencePriceCp: number,
 *   direction: 'import' | 'export',
 * }} params
 * @returns {number}
 */
export function offMapUnitPriceCp(params) {
  if (params.direction === 'import') {
    return params.referencePriceCp * OFF_MAP_IMPORT_PRICE_FACTOR
  }
  return params.referencePriceCp * OFF_MAP_EXPORT_PRICE_FACTOR
}

/**
 * @typedef {Object} OffMapProgressHooks
 * @property {(itemIndex: number, itemCount: number) => void} [onItem]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * Residual off-map clearing: export dump (ports + inland relays), then capacity-gated
 * imports (port needs first, then hinterland pass-through).
 *
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {OffMapProgressHooks} [options]
 */
export async function clearOffMapTrade(state, options = {}) {
  const { onItem, yieldToUi } = options
  const living = state.settlements
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ports = living.filter((s) => s.isPort)
  const inland = living.filter((s) => !s.isPort)
  const itemCount = living.length + ports.length + inland.length
  let itemIndex = 0

  for (const origin of living) {
    itemIndex += 1
    onItem?.(itemIndex, itemCount)
    await yieldToUi?.()
    exportSettlementResidual(state, origin, ports)
  }

  /** @type {Map<string, number>} */
  const importBudgetLbByPortId = new Map(
    ports.map((port) => [port.id, offMapCargoCapacityLb(port.population)]),
  )

  for (const port of ports) {
    itemIndex += 1
    onItem?.(itemIndex, itemCount)
    await yieldToUi?.()
    importPortOwnNeeds(state, port, importBudgetLbByPortId)
  }

  for (const claimant of inland) {
    itemIndex += 1
    onItem?.(itemIndex, itemCount)
    await yieldToUi?.()
    importInlandViaPorts(state, claimant, ports, importBudgetLbByPortId)
  }
}

/**
 * Synchronous residual off-map clearing (founding commit / tests).
 * @param {import('./runTradeClearing.js').ClearingState} state
 */
export function clearOffMapTradeSync(state) {
  const living = state.settlements
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ports = living.filter((s) => s.isPort)
  const inland = living.filter((s) => !s.isPort)

  for (const origin of living) {
    exportSettlementResidual(state, origin, ports)
  }

  /** @type {Map<string, number>} */
  const importBudgetLbByPortId = new Map(
    ports.map((port) => [port.id, offMapCargoCapacityLb(port.population)]),
  )

  for (const port of ports) {
    importPortOwnNeeds(state, port, importBudgetLbByPortId)
  }
  for (const claimant of inland) {
    importInlandViaPorts(state, claimant, ports, importBudgetLbByPortId)
  }
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{ id: string, population: number, isPort: boolean }} origin
 * @param {ReadonlyArray<{ id: string, population: number, isPort: boolean }>} ports
 */
function exportSettlementResidual(state, origin, ports) {
  const bag = state.held.get(origin.id)
  if (!bag) return
  const surplus = exportSurplusByCommodity(bag, origin.population)

  for (const commodityId of COMMODITY_IDS) {
    let available = surplus[commodityId]
    if (!(available > EPSILON)) continue

    if (commodityId === 'fish') {
      const maxFishByCuring = (bag.salt ?? 0) * FISH_CURING_SALT_PER_FISH_LB
      available = Math.min(available, maxFishByCuring)
      if (!(available > EPSILON)) continue
    }

    const unitPriceCp = offMapUnitPriceCp({
      referencePriceCp: referencePriceCp(commodityId),
      direction: 'export',
    })
    if (!(unitPriceCp > EPSILON)) continue

    if (origin.isPort) {
      dumpFromPort(state, {
        originId: origin.id,
        exitPortId: origin.id,
        commodityId,
        qty: available,
        unitPriceCp,
        path: null,
      })
      continue
    }

    if (ports.length === 0) continue
    const best = pickCheapestExportPath(state, origin.id, ports, commodityId, unitPriceCp)
    if (!best) continue
    const qty = Math.min(available, best.path.bottleneckUnits)
    if (!(qty > EPSILON)) continue
    dumpFromPort(state, {
      originId: origin.id,
      exitPortId: best.portId,
      commodityId,
      qty,
      unitPriceCp,
      path: best.path,
    })
  }
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} originId
 * @param {ReadonlyArray<{ id: string }>} ports
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @param {number} unitPriceCp
 * @returns {{ portId: string, path: import('./pathSearch.js').FoundPath } | null}
 */
function pickCheapestExportPath(state, originId, ports, commodityId, unitPriceCp) {
  const unitTollCp = PORT_TOLL_RATE * unitPriceCp
  /** @type {{ portId: string, path: import('./pathSearch.js').FoundPath } | null} */
  let best = null
  for (const port of ports) {
    const path = findMinCostPath({
      edges: state.edges,
      remainingCapLbByEdgeId: state.remainingCapLbByEdgeId,
      sourceIds: [originId],
      targetId: port.id,
      commodityId,
      isPort: state.isPort,
      unitTollCp,
    })
    if (!path) continue
    if (unitPriceCp + EPSILON < path.transportUnitCp) continue
    if (
      !best ||
      path.transportUnitCp < best.path.transportUnitCp - 1e-12 ||
      (Math.abs(path.transportUnitCp - best.path.transportUnitCp) <= 1e-12 && port.id < best.portId)
    ) {
      best = { portId: port.id, path }
    }
  }
  return best
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{
 *   originId: string,
 *   exitPortId: string,
 *   commodityId: import('../commodityCatalog.js').CommodityId,
 *   qty: number,
 *   unitPriceCp: number,
 *   path: import('./pathSearch.js').FoundPath | null,
 * }} params
 */
function dumpFromPort(state, params) {
  const { originId, exitPortId, commodityId, qty, unitPriceCp, path } = params
  const originBag = state.held.get(originId)
  if (!originBag || !(qty > EPSILON)) return

  originBag[commodityId] -= qty
  if (commodityId === 'fish') {
    originBag.salt -= qty / FISH_CURING_SALT_PER_FISH_LB
  }

  if (path) {
    const cargoLb = cargoLbPerUnit(commodityId)
    for (const leg of path.legs) {
      state.remainingCapLbByEdgeId.set(
        leg.edgeId,
        (state.remainingCapLbByEdgeId.get(leg.edgeId) ?? 0) - qty * cargoLb,
      )
      state.flows.push({
        edgeId: leg.edgeId,
        fromSettlementId: leg.from,
        toSettlementId: leg.to,
        commodityId,
        amount: qty,
        mode: leg.mode,
      })
    }
    for (const event of path.tollEvents) {
      creditExternalPortToll(state, event.portId, event.unitTollCp * qty)
    }
  }

  const saleCp = unitPriceCp * qty
  const loadingTollCp = PORT_TOLL_RATE * saleCp
  creditExternal(state, exitPortId, saleCp)
  creditExternalPortToll(state, exitPortId, loadingTollCp)
  addObligationLocal(state, {
    fromSettlementId: exitPortId,
    toSettlementId: originId,
    amountCp: saleCp,
    kind: 'goods',
  })

  recordOffMap(state, {
    settlementId: exitPortId,
    originSettlementId: originId,
    commodityId,
    direction: 'export',
    amount: qty,
    unitPriceCp,
  })
  markRoleLocal(state, originId, commodityId, 'export')
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{ id: string, population: number }} port
 * @param {Map<string, number>} importBudgetLbByPortId
 */
function importPortOwnNeeds(state, port, importBudgetLbByPortId) {
  const bag = state.held.get(port.id)
  if (!bag) return
  let remaining = importBudgetLbByPortId.get(port.id) ?? 0
  const shortfall = importShortfallByCommodity(bag, port.population)

  for (const commodityId of COMMODITY_IDS) {
    const need = shortfall[commodityId]
    if (!(need > EPSILON)) continue
    const unitPriceCp = offMapUnitPriceCp({
      referencePriceCp: referencePriceCp(commodityId),
      direction: 'import',
    })
    if (!(unitPriceCp > 0)) continue
    const cargoLb = cargoLbPerUnit(commodityId)
    const affordable = (state.externalAccounts.get(port.id) ?? 0) / unitPriceCp
    const qty = Math.min(need, remaining / cargoLb, affordable)
    if (!(qty > EPSILON)) continue
    bag[commodityId] += qty
    remaining -= qty * cargoLb
    creditExternal(state, port.id, -unitPriceCp * qty)
    recordOffMap(state, {
      settlementId: port.id,
      originSettlementId: port.id,
      commodityId,
      direction: 'import',
      amount: qty,
      unitPriceCp,
    })
    markRoleLocal(state, port.id, commodityId, 'import')
  }
  importBudgetLbByPortId.set(port.id, remaining)
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{ id: string, population: number }} claimant
 * @param {ReadonlyArray<{ id: string, population: number, isPort: boolean }>} ports
 * @param {Map<string, number>} importBudgetLbByPortId
 */
function importInlandViaPorts(state, claimant, ports, importBudgetLbByPortId) {
  const bag = state.held.get(claimant.id)
  if (!bag || ports.length === 0) return
  const shortfall = importShortfallByCommodity(bag, claimant.population)

  for (const commodityId of COMMODITY_IDS) {
    let need = shortfall[commodityId]
    if (!(need > EPSILON)) continue

    let resourceKind = offMapImportResourceKind(commodityId)
    if (state.overLimitAtOpen.get(claimant.id) === true) {
      if (resourceKind === 'prosperity') continue
      if (commodityId === 'grain' || commodityId === 'fish') {
        const foodHeld = (bag.grain ?? 0) + (bag.fish ?? 0)
        need = Math.min(need, Math.max(0, survivalFoodDemandLb(claimant.population) - foodHeld))
        if (!(need > EPSILON)) continue
      }
    } else if (commodityId === 'grain' || commodityId === 'fish') {
      const foodHeld = (bag.grain ?? 0) + (bag.fish ?? 0)
      if (foodHeld >= survivalFoodDemandLb(claimant.population) - EPSILON) {
        resourceKind = 'comfort'
      }
    }

    while (need > EPSILON) {
      const unitPriceCp = offMapUnitPriceCp({
        referencePriceCp: referencePriceCp(commodityId),
        direction: 'import',
      })
      const best = pickCheapestImportPath(
        state,
        claimant.id,
        ports,
        commodityId,
        unitPriceCp,
        importBudgetLbByPortId,
      )
      if (!best) break

      const cargoLb = cargoLbPerUnit(commodityId)
      const pierRemaining = importBudgetLbByPortId.get(best.portId) ?? 0
      const external = state.externalAccounts.get(best.portId) ?? 0
      const affordable = external / unitPriceCp
      const netUnitCp = unitPriceCp - best.path.transportUnitCp
      if (!(netUnitCp > EPSILON)) break

      const room = creditRoomCpForImport(state, claimant.id, resourceKind)
      const creditCap = Math.max(0, room) / netUnitCp
      const qty = Math.min(need, best.path.bottleneckUnits, pierRemaining / cargoLb, affordable, creditCap)
      if (!(qty > EPSILON)) break

      for (const leg of best.path.legs) {
        state.remainingCapLbByEdgeId.set(
          leg.edgeId,
          (state.remainingCapLbByEdgeId.get(leg.edgeId) ?? 0) - qty * cargoLb,
        )
        state.flows.push({
          edgeId: leg.edgeId,
          fromSettlementId: leg.from,
          toSettlementId: leg.to,
          commodityId,
          amount: qty,
          mode: leg.mode,
        })
      }
      for (const event of best.path.tollEvents) {
        creditExternalPortToll(state, event.portId, event.unitTollCp * qty)
      }

      creditExternal(state, best.portId, -unitPriceCp * qty)
      bag[commodityId] += qty
      importBudgetLbByPortId.set(best.portId, pierRemaining - qty * cargoLb)

      addObligationLocal(state, {
        fromSettlementId: claimant.id,
        toSettlementId: best.portId,
        amountCp: netUnitCp * qty,
        kind: 'goods',
      })

      recordOffMap(state, {
        settlementId: best.portId,
        originSettlementId: claimant.id,
        commodityId,
        direction: 'import',
        amount: qty,
        unitPriceCp,
      })
      markRoleLocal(state, claimant.id, commodityId, 'import')

      need -= qty
    }
  }
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} claimantId
 * @param {ReadonlyArray<{ id: string }>} ports
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @param {number} unitPriceCp
 * @param {Map<string, number>} importBudgetLbByPortId
 * @returns {{ portId: string, path: import('./pathSearch.js').FoundPath } | null}
 */
function pickCheapestImportPath(
  state,
  claimantId,
  ports,
  commodityId,
  unitPriceCp,
  importBudgetLbByPortId,
) {
  const unitTollCp = PORT_TOLL_RATE * unitPriceCp
  const cargoLb = cargoLbPerUnit(commodityId)
  /** @type {{ portId: string, path: import('./pathSearch.js').FoundPath } | null} */
  let best = null
  for (const port of ports) {
    if ((importBudgetLbByPortId.get(port.id) ?? 0) < cargoLb - EPSILON) continue
    if ((state.externalAccounts.get(port.id) ?? 0) < unitPriceCp - EPSILON) continue
    const path = findMinCostPath({
      edges: state.edges,
      remainingCapLbByEdgeId: state.remainingCapLbByEdgeId,
      sourceIds: [port.id],
      targetId: claimantId,
      commodityId,
      isPort: state.isPort,
      unitTollCp,
    })
    if (!path) continue
    if (unitPriceCp - path.transportUnitCp <= EPSILON) continue
    if (
      !best ||
      path.transportUnitCp < best.path.transportUnitCp - 1e-12 ||
      (Math.abs(path.transportUnitCp - best.path.transportUnitCp) <= 1e-12 && port.id < best.portId)
    ) {
      best = { portId: port.id, path }
    }
  }
  return best
}

/**
 * @param {Record<string, number>} bag
 * @param {number} population
 * @returns {Record<string, number>}
 */
export function exportSurplusByCommodity(bag, population) {
  /** @type {Record<string, number>} */
  const surplus = {}
  for (const id of COMMODITY_IDS) surplus[id] = 0

  const foodSurplus = Math.max(0, (bag.grain ?? 0) + (bag.fish ?? 0) - comfortFoodDemandLb(population))
  surplus.grain = Math.min(bag.grain ?? 0, foodSurplus)
  surplus.fish = Math.min(bag.fish ?? 0, Math.max(0, foodSurplus - surplus.grain))
  surplus.salt = Math.max(0, (bag.salt ?? 0) - survivalSaltDemandLb(population))
  for (const id of PROSPERITY_COMMODITIES) {
    surplus[id] = Math.max(0, (bag[id] ?? 0) - prosperityDemandUnits(id, population))
  }
  return surplus
}

/**
 * @param {Record<string, number>} bag
 * @param {number} population
 * @returns {Record<string, number>}
 */
export function importShortfallByCommodity(bag, population) {
  /** @type {Record<string, number>} */
  const shortfall = {}
  for (const id of COMMODITY_IDS) shortfall[id] = 0

  const foodShortfall = Math.max(0, comfortFoodDemandLb(population) - (bag.grain ?? 0) - (bag.fish ?? 0))
  shortfall.grain = foodShortfall
  shortfall.salt = Math.max(0, survivalSaltDemandLb(population) - (bag.salt ?? 0))
  for (const id of PROSPERITY_COMMODITIES) {
    shortfall[id] = Math.max(0, prosperityDemandUnits(id, population) - (bag[id] ?? 0))
  }
  return shortfall
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} id
 * @param {number} deltaCp
 */
function creditExternal(state, id, deltaCp) {
  const next = Math.max(0, (state.externalAccounts.get(id) ?? 0) + deltaCp)
  state.externalAccounts.set(id, next)
}

/**
 * Credit an external account with a port toll and record it for inspect totals.
 *
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} id
 * @param {number} tollCp
 */
function creditExternalPortToll(state, id, tollCp) {
  if (!(tollCp > EPSILON)) return
  creditExternal(state, id, tollCp)
  state.offMapPortTollIncomeCp.set(id, (state.offMapPortTollIncomeCp.get(id) ?? 0) + tollCp)
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {import('./runTradeClearing.js').ObligationDelta} delta
 */
function addObligationLocal(state, delta) {
  if (delta.fromSettlementId === delta.toSettlementId) return
  if (!(delta.amountCp > EPSILON)) return
  state.obligationDeltas.push(delta)
  state.netOwed.set(delta.fromSettlementId, (state.netOwed.get(delta.fromSettlementId) ?? 0) + delta.amountCp)
  state.netOwed.set(delta.toSettlementId, (state.netOwed.get(delta.toSettlementId) ?? 0) - delta.amountCp)
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} id
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @param {'import' | 'export'} direction
 */
function markRoleLocal(state, id, commodityId, direction) {
  const current = state.roles[id]?.[commodityId]
  if (!current) return
  if (current === 'neither') state.roles[id][commodityId] = direction
  else if (current !== direction) state.roles[id][commodityId] = 'both'
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{
 *   settlementId: string,
 *   originSettlementId: string,
 *   commodityId: import('../commodityCatalog.js').CommodityId,
 *   direction: 'import' | 'export',
 *   amount: number,
 *   unitPriceCp: number,
 * }} row
 */
function recordOffMap(state, row) {
  state.offMapTrades.push(row)
  const roles = state.roles[row.originSettlementId]
  if (!roles) return
  const current = roles[row.commodityId]
  if (current === 'neither') roles[row.commodityId] = row.direction
  else if (current !== row.direction) roles[row.commodityId] = 'both'
}
