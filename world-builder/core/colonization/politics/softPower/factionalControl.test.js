import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countLivingFactionControl,
  factionHasTerritoryColorByControl,
  resolveFactionalController,
  resolveMapGraySettlementIds,
} from './factionalControl.js'

function living(id, factionId = null, extra = {}) {
  return {
    id,
    factionId,
    status: 'living',
    population: 100,
    isTradePartner: false,
    vassalLiegeSettlementId: null,
    ...extra,
  }
}

test('sticky membership wins over rival soft-power paint', () => {
  const settlement = living('m', 'home')
  const controller = resolveFactionalController(settlement, {
    softPowerPaintBySettlementId: { m: 'rival' },
    factions: [{ id: 'home', status: 'active', settlementIds: ['m', 'cap'] }],
    settlements: [settlement, living('cap', 'home')],
  })
  assert.equal(controller, 'home')
})

test('trade partner membership paints host faction', () => {
  const settlement = living('tp', 'fa', { isTradePartner: true })
  assert.equal(
    resolveFactionalController(settlement, {
      softPowerPaintBySettlementId: {},
      factions: [{ id: 'fa', status: 'active', settlementIds: ['cap', 'tp'] }],
      settlements: [living('cap', 'fa'), settlement],
    }),
    'fa',
  )
})

test('map-gray pin uses armed soft-power controller', () => {
  const free = living('free')
  assert.equal(
    resolveFactionalController(free, {
      softPowerPaintBySettlementId: { free: 'fa' },
      factions: [{ id: 'fa', status: 'active', settlementIds: ['cap', 'm'] }],
      settlements: [living('cap', 'fa'), living('m', 'fa'), free],
    }),
    'fa',
  )
})

test('singleton faction capital is map-gray and can take soft-power paint', () => {
  const solo = living('solo', 'solo-f')
  const settlements = [solo, living('cap', 'fa'), living('m', 'fa')]
  const factions = [
    { id: 'solo-f', status: 'active', settlementIds: ['solo'] },
    { id: 'fa', status: 'active', settlementIds: ['cap', 'm'] },
  ]
  const gray = resolveMapGraySettlementIds({ settlements, factions })
  assert.ok(gray.has('solo'))
  assert.equal(
    resolveFactionalController(solo, {
      softPowerPaintBySettlementId: { solo: 'fa' },
      factions,
      settlements,
    }),
    'fa',
  )
})

test('true gray when no controller', () => {
  const free = living('free')
  assert.equal(
    resolveFactionalController(free, {
      softPowerPaintBySettlementId: {},
      factions: [],
      settlements: [free],
    }),
    null,
  )
})

test('ColorBrewer eligibility uses control count including soft-power seats', () => {
  const settlements = [
    living('cap', 'fa'),
    living('free'),
  ]
  const factions = [{ id: 'fa', status: 'active', settlementIds: ['cap'] }]
  const paint = { free: 'fa' }
  assert.equal(countLivingFactionControl('fa', { settlements, factions, softPowerPaintBySettlementId: paint }), 2)
  assert.equal(
    factionHasTerritoryColorByControl('fa', {
      settlements,
      factions,
      softPowerPaintBySettlementId: paint,
    }),
    true,
  )
  assert.equal(
    factionHasTerritoryColorByControl('fa', {
      settlements,
      factions,
      softPowerPaintBySettlementId: {},
    }),
    false,
  )
})
