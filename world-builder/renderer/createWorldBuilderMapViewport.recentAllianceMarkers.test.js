import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { applyColonizationSliceToWorldDocument } from '../core/colonization/colonizationPhaseTransitions.js'
import { createDefaultColonizationSlice } from '../core/colonization/createDefaultColonizationSlice.js'
import { applyAllianceMembership } from '../core/colonization/politics/politicalPressure/applyAllianceMembership.js'
import {
  createHostEl,
  createOverlayOwnerDriver,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'
import { RECENT_ALLIANCE_ICON_COLOR } from './settlementNodeMarkers.js'

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

function greenHandshakeFillCount() {
  return viewportSpyState.drawnFills.filter((fill) => fill.color === RECENT_ALLIANCE_ICON_COLOR)
    .length
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function allianceMarkerFixture() {
  return worldDocFixture({
    gridWidth: 8,
    gridHeight: 8,
    epoch: 20,
    settlements: [
      {
        id: 'capital-a',
        x: 2,
        y: 2,
        status: 'living',
        factionId: 'fa',
        population: 400,
      },
      {
        id: 'joined',
        x: 5,
        y: 3,
        status: 'living',
        factionId: 'fa',
        population: 120,
        vassalLiegeSettlementId: 'capital-a',
      },
    ],
    factions: [
      {
        id: 'fa',
        status: 'active',
        capitalSettlementId: 'capital-a',
        settlementIds: ['capital-a', 'joined'],
      },
    ],
    recentAllianceBySettlementId: {
      joined: { allianceEpoch: 20, factionId: 'fa', kind: 'join_existing' },
    },
  })
}

test(
  'createWorldBuilderMapViewport draws handshake via recentConquestMarkers when overlays are on',
  viewportTestOptions,
  async () => {
    const fixture = allianceMarkerFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.equal(greenHandshakeFillCount(), 0, 'handshake stays hidden while factionTerritory is off')

    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    assert.ok(
      greenHandshakeFillCount() > 0,
      'viewport Graphics path must fill the alliance handshake layer',
    )

    overlay.setVisibility('factionTerritory', false)
    assert.equal(greenHandshakeFillCount(), 0)

    viewport.destroy()
  },
)

test(
  'createWorldBuilderMapViewport culls handshake after alliance TTL epoch',
  viewportTestOptions,
  async () => {
    const fixture = allianceMarkerFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)
    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    assert.ok(greenHandshakeFillCount() > 0)

    viewport.updateWorldDocument({ ...fixture, epoch: 21 })
    assert.equal(greenHandshakeFillCount(), 0, 'handshake culled after one-epoch TTL')

    viewport.destroy()
  },
)

test(
  'alliance membership merges onto world document and viewport draw path shows handshake',
  viewportTestOptions,
  async () => {
    const geography = worldDocFixture({
      gridWidth: 8,
      gridHeight: 8,
    })

    let slice = createDefaultColonizationSlice()
    slice.epoch = 20
    slice.settlements = [
      {
        id: 'cap',
        x: 1,
        y: 1,
        status: 'living',
        factionId: 'fa',
        population: 800,
      },
      {
        id: 'member',
        x: 2,
        y: 1,
        status: 'living',
        factionId: 'fa',
        population: 200,
      },
      {
        id: 'free',
        x: 4,
        y: 1,
        status: 'living',
        factionId: null,
        population: 90,
      },
    ]
    slice.factions = [
      {
        id: 'fa',
        status: 'active',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'member'],
      },
    ]
    slice.politicalPressureArmedBySettlementId = { free: 'fa' }
    slice.recentAllianceBySettlementId = {}
    slice.historyLog = []

    const { slice: next } = applyAllianceMembership({ slice })
    assert.ok(next.recentAllianceBySettlementId.free)
    assert.equal(next.recentAllianceBySettlementId.free.allianceEpoch, 20)
    assert.equal(next.recentAllianceBySettlementId.free.kind, 'join_existing')

    const worldDocument = applyColonizationSliceToWorldDocument(geography, next)
    assert.ok(worldDocument.recentAllianceBySettlementId?.free)

    const viewport = await createWorldBuilderMapViewport(createHostEl(), geography)
    const overlay = createOverlayOwnerDriver(viewport)
    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    viewport.updateWorldDocument(worldDocument)

    assert.ok(
      greenHandshakeFillCount() > 0,
      'merged alliance stamp must reach createWorldBuilderMapViewport Graphics draw',
    )

    viewport.destroy()
  },
)
