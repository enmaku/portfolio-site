import assert from 'node:assert/strict'
import test from 'node:test'
import { CONQUEST_CAUSE_QUASHED_REBELLION } from '../core/colonization/politics/conflict/conquestCause.js'
import { POPULACE_APPEASED_CAUSE } from '../core/colonization/politics/softPower/populaceAppeased.js'
import { buildPoliticalMarkerTooltip } from './buildPoliticalMarkerTooltip.js'

test('swords tooltip discriminates quashed rebellion from conquest', () => {
  const quashed = buildPoliticalMarkerTooltip({
    marker: 'swords',
    cause: CONQUEST_CAUSE_QUASHED_REBELLION,
  })
  const conquest = buildPoliticalMarkerTooltip({ marker: 'swords', cause: 'conquest' })
  assert.equal(quashed?.cueKind, 'quashed_rebellion')
  assert.equal(conquest?.cueKind, 'conquest')
  assert.notEqual(quashed?.cueKind, conquest?.cueKind)
})

test('handshake tooltip discriminates peer mint, join existing, and populace appeased', () => {
  const peer = buildPoliticalMarkerTooltip({ marker: 'handshake', allianceKind: 'peer_mint' })
  const join = buildPoliticalMarkerTooltip({
    marker: 'handshake',
    allianceKind: 'join_existing',
  })
  const appeased = buildPoliticalMarkerTooltip({
    marker: 'handshake',
    allianceKind: 'join_existing',
    cause: POPULACE_APPEASED_CAUSE,
  })
  assert.equal(peer?.cueKind, 'alliance_peer_mint')
  assert.equal(join?.cueKind, 'alliance_join_existing')
  assert.equal(appeased?.cueKind, 'populace_appeased')
})

test('sack tooltip discriminates populace appeased from ordinary trade partner', () => {
  const ordinary = buildPoliticalMarkerTooltip({ marker: 'sack' })
  const appeased = buildPoliticalMarkerTooltip({
    marker: 'sack',
    cause: POPULACE_APPEASED_CAUSE,
  })
  assert.equal(ordinary?.cueKind, 'trade_partner')
  assert.equal(appeased?.cueKind, 'populace_appeased')
})
