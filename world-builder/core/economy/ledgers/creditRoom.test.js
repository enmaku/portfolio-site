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

test('comfort and prosperity never borrow and freeze when opening in debt', () => {
  const zeroOpen = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 0]]),
    netOwed: new Map([['a', 0]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(zeroOpen, 'a', 'prosperity'), 0)
  assert.equal(creditRoomCpForImport(zeroOpen, 'a', 'comfort'), 0)

  const creditor = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', -50]]),
    netOwed: new Map([['a', -50]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(creditor, 'a', 'prosperity'), 50)

  const openedInDebt = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', -30]]),
    creditLimit: new Map([['a', 500]]),
  }
  assert.equal(creditRoomCpForImport(openedInDebt, 'a', 'prosperity'), 0)
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
