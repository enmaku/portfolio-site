import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIAMOND_GEMS_PER_EXTRACTION,
  PRECIOUS_METAL_LB_PER_EXTRACTION,
  emptyCommodityAmounts,
  extractClaimedMineralDeposits,
  mineralDepositExtraction,
} from './productionAccounting.js'

function makeDeposit(id, kind) {
  return { id, x: 0, y: 0, score: 1, kind }
}

test('mineralDepositExtraction maps kinds to catalog commodities and amounts', () => {
  assert.deepStrictEqual(mineralDepositExtraction('copper'), {
    commodity: 'copper',
    amount: PRECIOUS_METAL_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('silver'), {
    commodity: 'silver',
    amount: PRECIOUS_METAL_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('gold'), {
    commodity: 'gold',
    amount: PRECIOUS_METAL_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('diamond'), {
    commodity: 'diamonds',
    amount: DIAMOND_GEMS_PER_EXTRACTION,
  })
})

test('claimed deposits yield one extraction unit per epoch by kind', () => {
  const deposits = [
    makeDeposit('metal-0', 'copper'),
    makeDeposit('metal-1', 'silver'),
    makeDeposit('metal-2', 'gold'),
    makeDeposit('metal-3', 'diamond'),
  ]

  const amounts = extractClaimedMineralDeposits(deposits, () => true)
  assert.strictEqual(amounts.copper, 1)
  assert.strictEqual(amounts.silver, 1)
  assert.strictEqual(amounts.gold, 1)
  assert.strictEqual(amounts.diamonds, 1)
})

test('unclaimed deposits yield nothing', () => {
  const deposits = [makeDeposit('metal-0', 'copper'), makeDeposit('metal-1', 'diamond')]
  const amounts = extractClaimedMineralDeposits(deposits, () => false)
  assert.deepStrictEqual(amounts, emptyCommodityAmounts())
})

test('only claimed deposits contribute; multiple of a kind accumulate', () => {
  const deposits = [
    makeDeposit('metal-0', 'copper'),
    makeDeposit('metal-1', 'copper'),
    makeDeposit('metal-2', 'gold'),
  ]
  const claimed = new Set(['metal-0', 'metal-2'])
  const amounts = extractClaimedMineralDeposits(deposits, (deposit) => claimed.has(deposit.id))
  assert.strictEqual(amounts.copper, 1)
  assert.strictEqual(amounts.gold, 1)
})