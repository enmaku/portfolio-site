import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isTaxedFactionMember,
  taxedMemberSettlementIds,
} from './taxedMembers.js'

test('trade partners are excluded from taxed member projection pools', () => {
  const settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    {
      id: 'tp',
      factionId: 'fa',
      isTradePartner: true,
      status: 'living',
      population: 50,
    },
  ]
  assert.equal(isTaxedFactionMember(settlements[2]), false)
  assert.deepEqual(
    taxedMemberSettlementIds({
      factionId: 'fa',
      settlements,
      settlementIds: ['cap', 'm', 'tp'],
    }),
    ['cap', 'm'],
  )
})
