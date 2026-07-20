import assert from 'node:assert/strict'
import test from 'node:test'
import { creditRoomCpForImport, offMapImportResourceKind } from './creditRoom.js'

test('survival under limit uses creditLimit minus netOwed', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 10]]),
    netOwed: new Map([['a', 40]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 60)
  assert.equal(creditRoomCpForImport(state, 'a', 'salt'), 60)
})

test('opening in debt freezes comfort and prosperity for the whole epoch', () => {
  const stillInDebt = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 40]]),
    netOwed: new Map([['a', 40]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(stillInDebt, 'a', 'comfort'), 0)
  assert.equal(creditRoomCpForImport(stillInDebt, 'a', 'prosperity'), 0)

  const clearedMidEpoch = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', -30]]),
    creditLimit: new Map([['a', 500]]),
  }
  assert.equal(creditRoomCpForImport(clearedMidEpoch, 'a', 'prosperity'), 0)
})

test('zero-balance settlements may use the credit line for prosperity', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 0]]),
    netOwed: new Map([['a', 0]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'prosperity'), 100)
  assert.equal(creditRoomCpForImport(state, 'a', 'comfort'), 100)
})

test('over limit survival uses earnings only', () => {
  const state = {
    overLimitAtOpen: new Map([['a', true]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', 150]]),
    creditLimit: new Map([['a', 50]]),
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
