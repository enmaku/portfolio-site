import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FACTION_TERRITORY_UNALIGNED_RGB,
  factionTerritoryRgb,
} from './buildFactionTerritoryOverlayRgba.js'
import { factionNamesLegendRgb } from './drawFactionNamesLegend.js'

test('factionNamesLegendRgb uses ColorBrewer when faction controls two living pins', () => {
  const worldDocument = {
    factions: [
      {
        id: 'fa',
        status: 'active',
        capitalSettlementId: 'a',
        settlementIds: ['a', 'b'],
        territoryPaletteIndex: 3,
      },
    ],
    settlements: [
      { id: 'a', factionId: 'fa', status: 'living', population: 100 },
      { id: 'b', factionId: 'fa', status: 'living', population: 80 },
    ],
    softPowerPaintBySettlementId: {},
  }
  assert.deepEqual(
    factionNamesLegendRgb('fa', worldDocument),
    factionTerritoryRgb('fa', worldDocument.factions),
  )
})

test('factionNamesLegendRgb uses unaligned gray for singleton-control factions', () => {
  const worldDocument = {
    factions: [
      {
        id: 'solo',
        status: 'active',
        capitalSettlementId: 's',
        settlementIds: ['s'],
        territoryPaletteIndex: 11,
      },
    ],
    settlements: [{ id: 's', factionId: 'solo', status: 'living', population: 50 }],
    softPowerPaintBySettlementId: {},
  }
  assert.deepEqual(factionNamesLegendRgb('solo', worldDocument), [
    ...FACTION_TERRITORY_UNALIGNED_RGB,
  ])
})
