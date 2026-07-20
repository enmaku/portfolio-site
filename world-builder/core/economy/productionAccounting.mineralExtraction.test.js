import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COPPER_LB_PER_EXTRACTION,
  DIAMOND_GEMS_PER_EXTRACTION,
  GOLD_LB_PER_EXTRACTION,
  SILVER_LB_PER_EXTRACTION,
  emptyCommodityAmounts,
  extractClaimedMineralDeposits,
  mineralDepositExtraction,
} from './productionAccounting.js'

function makeDeposit(id, kind) {
  return { id, x: 0, y: 0, score: 1, kind }
}

test('mineral deposit yields follow the grain-export rarity ladder', () => {
  assert.equal(COPPER_LB_PER_EXTRACTION, 85000)
  assert.equal(SILVER_LB_PER_EXTRACTION, 12500)
  assert.equal(GOLD_LB_PER_EXTRACTION, 1500)
  assert.equal(DIAMOND_GEMS_PER_EXTRACTION, 25)
  assert.ok(COPPER_LB_PER_EXTRACTION > SILVER_LB_PER_EXTRACTION)
  assert.ok(SILVER_LB_PER_EXTRACTION > GOLD_LB_PER_EXTRACTION)
  assert.equal(DIAMOND_GEMS_PER_EXTRACTION, Math.trunc(DIAMOND_GEMS_PER_EXTRACTION))
})

test('mineralDepositExtraction maps kinds to catalog commodities and amounts', () => {
  assert.deepStrictEqual(mineralDepositExtraction('copper'), {
    commodity: 'copper',
    amount: COPPER_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('silver'), {
    commodity: 'silver',
    amount: SILVER_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('gold'), {
    commodity: 'gold',
    amount: GOLD_LB_PER_EXTRACTION,
  })
  assert.deepStrictEqual(mineralDepositExtraction('diamond'), {
    commodity: 'diamonds',
    amount: DIAMOND_GEMS_PER_EXTRACTION,
  })
})

test('claimed deposits yield one annual haul per epoch by kind', () => {
  const deposits = [
    makeDeposit('metal-0', 'copper'),
    makeDeposit('metal-1', 'silver'),
    makeDeposit('metal-2', 'gold'),
    makeDeposit('metal-3', 'diamond'),
  ]

  const amounts = extractClaimedMineralDeposits(deposits, () => true)
  assert.strictEqual(amounts.copper, COPPER_LB_PER_EXTRACTION)
  assert.strictEqual(amounts.silver, SILVER_LB_PER_EXTRACTION)
  assert.strictEqual(amounts.gold, GOLD_LB_PER_EXTRACTION)
  assert.strictEqual(amounts.diamonds, DIAMOND_GEMS_PER_EXTRACTION)
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
  assert.strictEqual(amounts.copper, COPPER_LB_PER_EXTRACTION)
  assert.strictEqual(amounts.gold, GOLD_LB_PER_EXTRACTION)
})
