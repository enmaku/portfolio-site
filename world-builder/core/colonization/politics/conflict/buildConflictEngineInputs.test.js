import assert from 'node:assert/strict'
import test from 'node:test'
import { FOOD_LB_PER_PERSON } from '../../../economy/survivalDemand.js'
import {
  buildConflictEngineInputs,
  scoreStakeResourceAttractiveness,
} from './buildConflictEngineInputs.js'
import {
  getConflictTuning,
  resetConflictTuning,
  setConflictTuning,
} from './conflictTuning.js'

test.afterEach(() => {
  resetConflictTuning()
})

test('scoreStakeResourceAttractiveness scales toll wealth food metals and unaligned', () => {
  setConflictTuning({
    tollCap: 25,
    tollCpForCap: 5_000,
    foodCap: 30,
    foodSurplusForCap: 25,
    unalignedBonus: 25,
    warThreshold: 50,
  })
  assert.equal(scoreStakeResourceAttractiveness({}), 0)
  assert.equal(
    scoreStakeResourceAttractiveness({
      portTollIncomeCp: getConflictTuning().tollCpForCap,
    }),
    getConflictTuning().tollCap,
  )
  assert.ok(
    scoreStakeResourceAttractiveness({
      foodSurplusPeople: 10,
      portTollIncomeCp: 3_000,
      unaligned: true,
    }) >= getConflictTuning().warThreshold,
  )
  assert.ok(
    scoreStakeResourceAttractiveness({
      foodSurplusPeople: 10,
      portTollIncomeCp: 3_000,
      unaligned: false,
    }) < getConflictTuning().warThreshold,
  )
})

test('buildConflictEngineInputs maps survival and trade snapshot into conflict maps', () => {
  setConflictTuning({ tollCap: 25, tollCpForCap: 5_000 })
  const built = buildConflictEngineInputs({
    slice: {
      settlements: [
        { id: 'a', status: 'living' },
        { id: 'ruin', status: 'ruin' },
      ],
      externalTradeAccounts: { a: 100 },
      lastTradeEpochResult: {
        realmBalancesCp: { a: 4_900 },
        portTollIncomeCpBySettlementId: { a: 5_000 },
      },
    },
    survivalBySettlementId: {
      a: { foodSurplus: 10 },
    },
    baseMetalsLbBySettlementId: { a: 300 },
  })

  assert.equal(built.martialInputBySettlementId.a.foodSurplusLb, 10 * FOOD_LB_PER_PERSON)
  assert.equal(built.martialInputBySettlementId.a.baseMetalsAccess, 300)
  assert.equal(built.martialInputBySettlementId.a.spendableWealthCp, 5_000)
  assert.ok(built.resourceScoreBySettlementId.a >= 25)
  assert.equal(built.martialInputBySettlementId.ruin, undefined)
  assert.equal(built.resourceScoreBySettlementId.ruin, undefined)
})
