import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { applyColonizationSliceToWorldDocument } from '../core/colonization/colonizationPhaseTransitions.js'
import { createDefaultColonizationSlice } from '../core/colonization/createDefaultColonizationSlice.js'
import {
  createHostEl,
  createOverlayOwnerDriver,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'
import {
  RECENT_CONQUEST_ICON_COLOR,
  TRADE_PARTNER_ICON_COLOR,
} from './settlementNodeMarkers.js'

/** @type {typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport} */
let createWorldBuilderMapViewport

before(async () => {
  if (!viewportTestOptions.skip) {
    createWorldBuilderMapViewport = await installViewportMocks()
  }
})

after(() => {
  uninstallViewportGlobals()
})

function sackFillCount() {
  return viewportSpyState.drawnFills.filter((fill) => fill.color === TRADE_PARTNER_ICON_COLOR)
    .length
}

function swordFillCount() {
  return viewportSpyState.drawnFills.filter((fill) => fill.color === RECENT_CONQUEST_ICON_COLOR)
    .length
}

/**
 * Contrived multi-member faction + sticky trade partner (same flags politics join sets).
 * Live entry: createWorldBuilderMapViewport → recentConquestMarkers → drawRecentConquestMarkers.
 *
 * @returns {import('../core/types.js').WorldDocument}
 */
function tradePartnerMarkerFixture() {
  return worldDocFixture({
    gridWidth: 8,
    gridHeight: 8,
    epoch: 20,
    settlements: [
      {
        id: 'capital',
        x: 2,
        y: 2,
        status: 'living',
        factionId: 'fa',
        population: 400,
      },
      {
        id: 'member',
        x: 3,
        y: 2,
        status: 'living',
        factionId: 'fa',
        population: 200,
      },
      {
        id: 'tp',
        x: 5,
        y: 3,
        status: 'living',
        factionId: 'fa',
        population: 90,
        isTradePartner: true,
        vassalLiegeSettlementId: null,
      },
    ],
    factions: [
      {
        id: 'fa',
        status: 'active',
        capitalSettlementId: 'capital',
        settlementIds: ['capital', 'member', 'tp'],
        territoryPaletteIndex: 0,
      },
    ],
    recentConquestBySettlementId: {},
  })
}

test(
  'createWorldBuilderMapViewport draws sack via recentConquestMarkers for isTradePartner',
  viewportTestOptions,
  async () => {
    const fixture = tradePartnerMarkerFixture()
    assert.equal(fixture.settlements.find((s) => s.id === 'tp')?.isTradePartner, true)

    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.equal(sackFillCount(), 0, 'sack stays hidden while factionTerritory is off')

    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    assert.ok(
      sackFillCount() > 0,
      'viewport Graphics path must fill the trade-partner sack SVG',
    )
    assert.equal(swordFillCount(), 0, 'swords must not draw for a non-conquest trade partner')

    overlay.setVisibility('factionTerritory', false)
    assert.equal(sackFillCount(), 0)

    viewport.destroy()
  },
)

test(
  'slice isTradePartner merges onto world document and viewport draw path shows sack',
  viewportTestOptions,
  async () => {
    const geography = worldDocFixture({
      gridWidth: 8,
      gridHeight: 8,
    })

    const slice = createDefaultColonizationSlice()
    slice.epoch = 15
    slice.settlements = [
      {
        id: 'cap',
        x: 1,
        y: 1,
        status: 'living',
        factionId: 'coast',
        population: 500,
      },
      {
        id: 'taxed',
        x: 2,
        y: 1,
        status: 'living',
        factionId: 'coast',
        population: 200,
      },
      {
        id: 'partner',
        x: 4,
        y: 2,
        status: 'living',
        factionId: 'coast',
        population: 80,
        isTradePartner: true,
        vassalLiegeSettlementId: null,
      },
    ]
    slice.factions = [
      {
        id: 'coast',
        status: 'active',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'taxed', 'partner'],
        territoryPaletteIndex: 1,
      },
    ]

    const worldDocument = applyColonizationSliceToWorldDocument(geography, slice)
    const partner = worldDocument.settlements.find((s) => s.id === 'partner')
    assert.equal(partner?.isTradePartner, true, 'merge must preserve isTradePartner on settlements')
    assert.equal(worldDocument.epoch, 15)

    const viewport = await createWorldBuilderMapViewport(createHostEl(), geography)
    const overlay = createOverlayOwnerDriver(viewport)
    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    viewport.updateWorldDocument(worldDocument)

    assert.ok(
      sackFillCount() > 0,
      'merged trade-partner flag must reach createWorldBuilderMapViewport Graphics draw',
    )

    viewport.destroy()
  },
)
