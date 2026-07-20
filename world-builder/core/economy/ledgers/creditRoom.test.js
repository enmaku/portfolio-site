import assert from 'node:assert/strict'
import test from 'node:test'
import {
  annualSurvivalBasketCp,
  creditRoomCpForImport,
  offMapImportResourceKind,
  SURVIVAL_DEBT_BRIDGE_YEARS,
  SURVIVAL_DEBT_HARD_STOP_YEARS,
} from './creditRoom.js'

test('annualSurvivalBasketCp values grain and salt floors at local-price ceiling', () => {
  // 100 people × 2× (365 cp grain + 25 cp salt) = 78_000
  assert.equal(annualSurvivalBasketCp(100), 78_000)
  assert.equal(SURVIVAL_DEBT_BRIDGE_YEARS, 1)
  assert.equal(SURVIVAL_DEBT_HARD_STOP_YEARS, 2)
})

test('survival under limit uses harvest caps when below both ceilings', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 10]]),
    netOwed: new Map([['a', 40]]),
    creditLimit: new Map([['a', 100]]),
    survivalBasketCp: new Map([['a', 1_000_000]]),
  }
  // hard stop = 2×100 = 200; room = 200 - 40 = 160
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 160)
  assert.equal(creditRoomCpForImport(state, 'a', 'salt'), 160)
})

test('survival borrowing stops at one annual staple basket', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 0]]),
    netOwed: new Map([['a', 90]]),
    creditLimit: new Map([['a', 1_000_000]]),
    survivalBasketCp: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 10)
  state.netOwed.set('a', 100)
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 0)
})

test('survival borrowing hard-stops at two years of collateral', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 0]]),
    netOwed: new Map([['a', 180]]),
    creditLimit: new Map([['a', 100]]),
    survivalBasketCp: new Map([['a', 1_000_000]]),
  }
  // Cap = min(basket, 2×100) = 200; room = 20
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 20)
  state.netOwed.set('a', 200)
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 0)
})

test('comfort and prosperity never borrow and freeze when opening in debt', () => {
  const zeroOpen = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 0]]),
    netOwed: new Map([['a', 0]]),
    creditLimit: new Map([['a', 100]]),
    survivalBasketCp: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(zeroOpen, 'a', 'prosperity'), 0)
  assert.equal(creditRoomCpForImport(zeroOpen, 'a', 'comfort'), 0)

  const creditor = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', -50]]),
    netOwed: new Map([['a', -50]]),
    creditLimit: new Map([['a', 100]]),
    survivalBasketCp: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(creditor, 'a', 'prosperity'), 50)

  const openedInDebt = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', -30]]),
    creditLimit: new Map([['a', 500]]),
    survivalBasketCp: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(openedInDebt, 'a', 'prosperity'), 0)
})

test('over limit survival uses earnings only without harvest-bridge clamp', () => {
  const state = {
    overLimitAtOpen: new Map([['a', true]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', 150]]),
    creditLimit: new Map([['a', 50]]),
    survivalBasketCp: new Map([['a', 10]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 50)
  assert.equal(creditRoomCpForImport(state, 'a', 'salt'), 50)
  assert.equal(creditRoomCpForImport(state, 'a', 'prosperity'), 0)
})

test('offMapImportResourceKind maps commodities to tiers', () => {
  assert.equal(offMapImportResourceKind('grain'), 'survival')
  assert.equal(offMapImportResourceKind('salt'), 'salt')
  assert.equal(offMapImportResourceKind('timber'), 'prosperity')
})
