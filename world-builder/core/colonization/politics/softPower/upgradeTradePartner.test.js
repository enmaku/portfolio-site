import assert from 'node:assert/strict'
import test from 'node:test'
import { upgradeTradePartnersOnSurvivalDependence } from './applyTradePartnerMembership.js'
import { createDefaultColonizationSlice } from '../../createDefaultColonizationSlice.js'

test('survival dependence upgrades trade partner to taxed vassal', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 5
  slice.settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    {
      id: 'tp',
      factionId: 'fa',
      isTradePartner: true,
      status: 'living',
      population: 50,
      vassalLiegeSettlementId: null,
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm', 'tp'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  const result = upgradeTradePartnersOnSurvivalDependence({
    slice,
    survivalBySettlementId: {
      tp: { ok: false, dependsOnFactionId: 'fa' },
    },
  })
  const tp = result.slice.settlements.find((s) => s.id === 'tp')
  assert.equal(tp.isTradePartner, false)
  assert.equal(tp.vassalLiegeSettlementId, 'cap')
  assert.equal(tp.factionId, 'fa')
})
