import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SETTLEMENT_PIN_RADIUS_CAPITAL,
  SETTLEMENT_PIN_RADIUS_MEMBER,
  SETTLEMENT_PIN_RADIUS_VASSAL,
  settlementPinMarkerRadius,
  settlementPinMembershipBand,
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
