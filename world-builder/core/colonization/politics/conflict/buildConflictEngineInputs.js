/**
 * Derive martial and resource-contest inputs from survival + trade snapshot.
 * Domain: world-builder/CONTEXT.md — Conquest, Martial capacity, economic contest.
 */

import { FOOD_LB_PER_PERSON } from '../../../economy/survivalDemand.js'
import { combinedSettlementWealthCp } from '../../../economy/ledgers/combinedSettlementWealthCp.js'
import { getConflictTuning } from './conflictTuning.js'

/**
 * @param {{
 *   foodSurplusPeople?: number,
 *   spendableWealthCp?: number,
 *   portTollIncomeCp?: number,
 *   baseMetalsLb?: number,
 *   unaligned?: boolean,
 * }} params
 * @returns {number}
 */
export function scoreStakeResourceAttractiveness(params) {
  const tuning = getConflictTuning()
  const foodPeople = Math.max(0, Number(params.foodSurplusPeople) || 0)
  const wealthCp = Math.max(0, Number(params.spendableWealthCp) || 0)
  const tollCp = Math.max(0, Number(params.portTollIncomeCp) || 0)
  const metalsLb = Math.max(0, Number(params.baseMetalsLb) || 0)

  const food = tuning.foodCap * Math.min(1, foodPeople / Math.max(1, tuning.foodSurplusForCap))
  const wealth = tuning.wealthCap * Math.min(1, wealthCp / Math.max(1, tuning.wealthCpForCap))
  const toll = tuning.tollCap * Math.min(1, tollCp / Math.max(1, tuning.tollCpForCap))
  const metals = tuning.metalsCap * Math.min(1, metalsLb / Math.max(1, tuning.metalsLbForCap))
  const unalignedBonus = params.unaligned ? tuning.unalignedBonus : 0

  return food + wealth + toll + metals + unalignedBonus
}

/**
 * @param {{
 *   slice: object,
 *   survivalBySettlementId?: Record<string, { foodSurplus?: number }>,
 *   baseMetalsLbBySettlementId?: Record<string, number>,
 * }} params
 * @returns {{
 *   martialInputBySettlementId: Record<string, {
 *     foodSurplusLb: number,
 *     baseMetalsAccess: number,
 *     spendableWealthCp: number,
 *   }>,
 *   resourceScoreBySettlementId: Record<string, number>,
 * }}
 */
export function buildConflictEngineInputs(params) {
  const survivalBySettlementId = params.survivalBySettlementId ?? {}
  const baseMetalsLbBySettlementId = params.baseMetalsLbBySettlementId ?? {}
  const trade = params.slice?.lastTradeEpochResult
  const balances = trade?.realmBalancesCp ?? {}
  const external = params.slice?.externalTradeAccounts ?? {}
  const tolls = trade?.portTollIncomeCpBySettlementId ?? {}

  /** @type {Record<string, { foodSurplusLb: number, baseMetalsAccess: number, spendableWealthCp: number }>} */
  const martialInputBySettlementId = {}
  /** @type {Record<string, number>} */
  const resourceScoreBySettlementId = {}

  for (const settlement of params.slice?.settlements ?? []) {
    if (settlement.status !== 'living') continue
    const id = settlement.id
    const foodSurplusPeople = Number(survivalBySettlementId[id]?.foodSurplus) || 0
    const foodSurplusLb = Math.max(0, foodSurplusPeople) * FOOD_LB_PER_PERSON
    const baseMetalsAccess = Math.max(0, Number(baseMetalsLbBySettlementId[id]) || 0)
    const spendableWealthCp = Math.max(
      0,
      combinedSettlementWealthCp({
        settlementId: id,
        balancesBySettlementId: balances,
        externalTradeAccounts: external,
      }),
    )
    const portTollIncomeCp = Math.max(0, Number(tolls[id]) || 0)

    martialInputBySettlementId[id] = {
      foodSurplusLb,
      baseMetalsAccess,
      spendableWealthCp,
    }
    resourceScoreBySettlementId[id] = scoreStakeResourceAttractiveness({
      foodSurplusPeople,
      spendableWealthCp,
      portTollIncomeCp,
      baseMetalsLb: baseMetalsAccess,
      unaligned: settlement.factionId == null,
    })
  }

  return { martialInputBySettlementId, resourceScoreBySettlementId }
}
