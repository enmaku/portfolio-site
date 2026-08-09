import assert from 'node:assert/strict'
import test from 'node:test'
import { hitTestPoliticalMarkerIcon } from './hitTestPoliticalMarkerIcon.js'
import {
  RECENT_CONQUEST_ICON_SIZE,
  settlementIdLabelOffsetX,
} from './settlementNodeMarkers.js'

function docWithSwords() {
  return {
    epoch: 14,
    settlements: [
      {
        id: 'pin',
        x: 10,
        y: 20,
        status: 'living',
        population: 100,
        factionId: 'fa',
      },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'pin',
        settlementIds: ['pin', 'other'],
        status: 'active',
        emergedEpoch: 0,
        territoryPaletteIndex: 0,
      },
    ],
    recentConquestBySettlementId: {
      pin: { conqueredEpoch: 14, priorFactionId: null, cause: 'conquest' },
    },
    bannerMembershipHistoryBySettlementId: {
      pin: ['fa', ''],
    },
    recentAllianceBySettlementId: {},
  }
}

test('hitTestPoliticalMarkerIcon hits swords AABB when faction overlay is on', () => {
  const doc = docWithSwords()
  const factions = doc.factions
  const settlements = doc.settlements
  const left =
    settlements[0].x + 0.5 + settlementIdLabelOffsetX(settlements[0], factions, settlements)
  const midY = settlements[0].y + 0.5
  const hit = hitTestPoliticalMarkerIcon(
    doc,
    { factionTerritory: true, settlements: true },
    left + RECENT_CONQUEST_ICON_SIZE / 2,
    midY,
  )
  assert.ok(hit)
  assert.equal(hit.marker, 'swords')
  assert.equal(hit.cause, 'quashed_rebellion')
})

test('hitTestPoliticalMarkerIcon misses when faction overlay is off', () => {
  const doc = docWithSwords()
  const factions = doc.factions
  const settlements = doc.settlements
  const left =
    settlements[0].x + 0.5 + settlementIdLabelOffsetX(settlements[0], factions, settlements)
  const midY = settlements[0].y + 0.5
  const hit = hitTestPoliticalMarkerIcon(
    doc,
    { factionTerritory: false, settlements: true },
    left + RECENT_CONQUEST_ICON_SIZE / 2,
    midY,
  )
  assert.equal(hit, null)
})
