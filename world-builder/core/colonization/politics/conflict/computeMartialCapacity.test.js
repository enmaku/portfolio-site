import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeMartialCapacity,
  defenderAdvantageMultiplier,
} from './computeMartialCapacity.js'
import { MERCENARY_TOP_UP_CAP_FRACTION } from './conflictConstants.js'

test('martial capacity is near zero when population is empty despite wealth and metals', () => {
  const empty = computeMartialCapacity({
    population: 0,
    foodSurplusLb: 1_000_000,
    baseMetalsAccess: 1_000_000,
    spendableWealthCp: 1_000_000,
  })
  assert.equal(empty, 0)

  const tiny = computeMartialCapacity({
    population: 1,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 1_000_000,
  })
  const richHamlet = computeMartialCapacity({
    population: 1,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 10_000_000,
  })
  assert.ok(tiny > 0)
  assert.ok(richHamlet <= tiny * (1 + MERCENARY_TOP_UP_CAP_FRACTION + 1e-9))
})

test('martial capacity scales primarily with population', () => {
  const small = computeMartialCapacity({
    population: 100,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const large = computeMartialCapacity({
    population: 1000,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  assert.ok(large > small * 9)
  assert.ok(large < small * 11)
})

test('food surplus uses combined grain+fish above survival, not grain alone', () => {
  const grainOnly = computeMartialCapacity({
    population: 100,
    foodSurplusLb: 10_000,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const grainAndFish = computeMartialCapacity({
    population: 100,
    foodSurplusLb: 20_000,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const baseline = computeMartialCapacity({
    population: 100,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  assert.ok(grainOnly > baseline)
  assert.ok(grainAndFish > grainOnly)
})

test('armament uses base metals access; precious minerals are excluded from the input', () => {
  const noMetal = computeMartialCapacity({
    population: 200,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const withBaseMetals = computeMartialCapacity({
    population: 200,
    foodSurplusLb: 0,
    baseMetalsAccess: 5_000,
    spendableWealthCp: 0,
  })
  assert.ok(withBaseMetals > noMetal)
})

test('wealth offsets weak feed/armament with at most modest merc top-up', () => {
  const poor = computeMartialCapacity({
    population: 500,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const rich = computeMartialCapacity({
    population: 500,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 5_000_000,
  })
  assert.ok(rich > poor)
  assert.ok(rich <= poor * (1 + MERCENARY_TOP_UP_CAP_FRACTION + 1e-9))

  const debtIgnored = computeMartialCapacity({
    population: 500,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: -1_000_000,
  })
  assert.equal(debtIgnored, poor)
})

test('defender advantage scales with tier and capital bump only for faction capitals', () => {
  const hamlet = defenderAdvantageMultiplier({ tier: 'hamlet', isFactionCapital: false })
  const city = defenderAdvantageMultiplier({ tier: 'city', isFactionCapital: false })
  const cityCapital = defenderAdvantageMultiplier({ tier: 'city', isFactionCapital: true })
  const unalignedCity = defenderAdvantageMultiplier({ tier: 'city', isFactionCapital: false })
  assert.ok(city > hamlet)
  assert.ok(cityCapital > city)
  assert.equal(unalignedCity, city)
})

test('war exhaustion penalty reduces martial capacity', () => {
  const fresh = computeMartialCapacity({
    population: 400,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
  })
  const exhausted = computeMartialCapacity({
    population: 400,
    foodSurplusLb: 0,
    baseMetalsAccess: 0,
    spendableWealthCp: 0,
    warExhaustionPenalty: 0.5,
  })
  assert.ok(exhausted < fresh)
  assert.ok(Math.abs(exhausted - fresh * 0.5) < 1e-9)
})
