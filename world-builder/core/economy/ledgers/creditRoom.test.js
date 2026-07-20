import assert from 'node:assert/strict'
import test from 'node:test'
import { creditRoomCpForImport, offMapImportResourceKind } from './creditRoom.js'

test('under limit uses creditLimit minus netOwed for every tier', () => {
  const state = {
    overLimitAtOpen: new Map([['a', false]]),
    openingNetOwed: new Map([['a', 10]]),
    netOwed: new Map([['a', 40]]),
    creditLimit: new Map([['a', 100]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'prosperity'), 60)
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 60)
})

test('over limit freezes comfort and prosperity; survival uses earnings only', () => {
  const state = {
    overLimitAtOpen: new Map([['a', true]]),
    openingNetOwed: new Map([['a', 200]]),
    netOwed: new Map([['a', 150]]),
    creditLimit: new Map([['a', 50]]),
  }
  assert.equal(creditRoomCpForImport(state, 'a', 'comfort'), 0)
  assert.equal(creditRoomCpForImport(state, 'a', 'prosperity'), 0)
  assert.equal(creditRoomCpForImport(state, 'a', 'survival'), 50)
  assert.equal(creditRoomCpForImport(state, 'a', 'salt'), 50)
})

test('offMapImportResourceKind maps commodities to tiers', () => {
  assert.equal(offMapImportResourceKind('grain'), 'survival')
  assert.equal(offMapImportResourceKind('salt'), 'salt')
  assert.equal(offMapImportResourceKind('timber'), 'prosperity')
})
