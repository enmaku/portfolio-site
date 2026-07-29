import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SETTLEMENT_PIN_RADIUS_CAPITAL,
  SETTLEMENT_PIN_RADIUS_MEMBER,
  SETTLEMENT_PIN_RADIUS_VASSAL,
  settlementPinMarkerRadius,
  settlementPinMembershipBand,
  wasConqueredLastEpoch,
  shouldShowTradePartnerSackMarker,
} from './settlementNodeMarkers.js'

const factions = [
  {
    id: 'faction-a',
    capitalSettlementId: 'capital',
    settlementIds: ['capital', 'member', 'vassal'],
    status: 'active',
  },
]

test('pin membership band orders capital > member = unaligned > vassal', () => {
  assert.strictEqual(
    settlementPinMembershipBand({ id: 'capital', factionId: 'faction-a' }, factions),
    'capital',
  )
  assert.strictEqual(
    settlementPinMembershipBand({ id: 'member', factionId: 'faction-a' }, factions),
    'member',
  )
  assert.strictEqual(
    settlementPinMembershipBand(
      { id: 'vassal', factionId: 'faction-a', vassalLiegeSettlementId: 'capital' },
      factions,
    ),
    'vassal',
  )
  assert.strictEqual(settlementPinMembershipBand({ id: 'lone', factionId: null }, factions), 'unaligned')
})

test('trade partner uses mid pin band like ordinary member', () => {
  const roster = [
    ...factions,
  ]
  roster[0] = {
    ...factions[0],
    settlementIds: ['capital', 'member', 'vassal', 'tp'],
  }
  assert.strictEqual(
    settlementPinMembershipBand(
      { id: 'tp', factionId: 'faction-a', isTradePartner: true },
      roster,
      [
        { id: 'capital', factionId: 'faction-a', population: 1 },
        { id: 'member', factionId: 'faction-a', population: 1 },
        { id: 'vassal', factionId: 'faction-a', population: 1 },
        { id: 'tp', factionId: 'faction-a', isTradePartner: true, population: 1 },
      ],
    ),
    'tradePartner',
  )
  assert.strictEqual(
    settlementPinMarkerRadius(
      { id: 'tp', factionId: 'faction-a', isTradePartner: true },
      roster,
      [
        { id: 'capital', factionId: 'faction-a', population: 1 },
        { id: 'member', factionId: 'faction-a', population: 1 },
        { id: 'tp', factionId: 'faction-a', isTradePartner: true, population: 1 },
      ],
    ),
    SETTLEMENT_PIN_RADIUS_MEMBER,
  )
})

test('singleton faction capital uses unaligned pin band', () => {
  const soloFactions = [
    {
      id: 'faction-solo',
      capitalSettlementId: 'only',
      settlementIds: ['only'],
      status: 'active',
    },
  ]
  assert.strictEqual(
    settlementPinMembershipBand({ id: 'only', factionId: 'faction-solo' }, soloFactions),
    'unaligned',
  )
  assert.strictEqual(
    settlementPinMarkerRadius({ id: 'only', factionId: 'faction-solo' }, soloFactions),
    SETTLEMENT_PIN_RADIUS_MEMBER,
  )
})

test('pin marker radii: capital largest, member and unaligned equal, vassal smallest', () => {
  const capital = settlementPinMarkerRadius({ id: 'capital', factionId: 'faction-a' }, factions)
  const member = settlementPinMarkerRadius({ id: 'member', factionId: 'faction-a' }, factions)
  const unaligned = settlementPinMarkerRadius({ id: 'lone', factionId: null }, factions)
  const vassal = settlementPinMarkerRadius(
    { id: 'vassal', factionId: 'faction-a', vassalLiegeSettlementId: 'capital' },
    factions,
  )
  assert.strictEqual(capital, SETTLEMENT_PIN_RADIUS_CAPITAL)
  assert.strictEqual(member, SETTLEMENT_PIN_RADIUS_MEMBER)
  assert.strictEqual(unaligned, SETTLEMENT_PIN_RADIUS_MEMBER)
  assert.strictEqual(vassal, SETTLEMENT_PIN_RADIUS_VASSAL)
  assert.ok(capital > member)
  assert.ok(member > vassal)
})

test('wasConqueredLastEpoch is true only for the conquest epoch', () => {
  assert.equal(
    wasConqueredLastEpoch({
      settlementId: 'border',
      epoch: 12,
      recentConquestBySettlementId: { border: { conqueredEpoch: 12 } },
    }),
    true,
  )
  assert.equal(
    wasConqueredLastEpoch({
      settlementId: 'border',
      epoch: 13,
      recentConquestBySettlementId: { border: { conqueredEpoch: 12 } },
    }),
    false,
  )
  assert.equal(
    wasConqueredLastEpoch({
      settlementId: 'other',
      epoch: 12,
      recentConquestBySettlementId: { border: { conqueredEpoch: 12 } },
    }),
    false,
  )
})

test('trade partner sack is a lasting status cue while isTradePartner', () => {
  assert.equal(
    shouldShowTradePartnerSackMarker({
      id: 'tp',
      factionId: 'fa',
      isTradePartner: true,
      status: 'living',
      population: 40,
    }),
    true,
  )
  assert.equal(
    shouldShowTradePartnerSackMarker({
      id: 'member',
      factionId: 'fa',
      isTradePartner: false,
      status: 'living',
      population: 40,
    }),
    false,
  )
  assert.equal(
    shouldShowTradePartnerSackMarker({
      id: 'free',
      factionId: null,
      status: 'living',
      population: 40,
    }),
    false,
  )
  assert.equal(
    shouldShowTradePartnerSackMarker({
      id: 'vassal',
      factionId: 'fa',
      isTradePartner: false,
      vassalLiegeSettlementId: 'cap',
      status: 'living',
      population: 40,
    }),
    false,
  )
})
