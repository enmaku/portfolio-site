import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { applyColonizationSliceToWorldDocument } from '../core/colonization/colonizationPhaseTransitions.js'
import { createDefaultColonizationSlice } from '../core/colonization/createDefaultColonizationSlice.js'
import { applyConquestResolution } from '../core/colonization/politics/conflict/applyConquestResolution.js'
import { resetConflictTuning } from '../core/colonization/politics/conflict/conflictTuning.js'
import {
  createHostEl,
  createOverlayOwnerDriver,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'
import { RECENT_CONQUEST_ICON_COLOR } from './settlementNodeMarkers.js'

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

function redSwordFillCount() {
  return viewportSpyState.drawnFills.filter((fill) => fill.color === RECENT_CONQUEST_ICON_COLOR)
    .length
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function conquestMarkerFixture() {
  return worldDocFixture({
    gridWidth: 8,
    gridHeight: 8,
    epoch: 12,
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
        id: 'taken',
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
        settlementIds: ['capital-a', 'taken'],
      },
    ],
    recentConquestBySettlementId: {
      taken: { conqueredEpoch: 12, priorFactionId: 'fb' },
    },
  })
}

test(
  'createWorldBuilderMapViewport draws swords via recentConquestMarkers layer when overlays are on',
  viewportTestOptions,
  async () => {
    const fixture = conquestMarkerFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.equal(redSwordFillCount(), 0, 'swords stay hidden while factionTerritory is off')

    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    assert.ok(
      redSwordFillCount() > 0,
      'viewport Graphics path must fill the conquest swords SVG',
    )

    overlay.setVisibility('factionTerritory', false)
    assert.equal(redSwordFillCount(), 0)

    viewport.destroy()
  },
)

test(
  'attacker conquest resolution merges onto world document and viewport draw path shows swords',
  viewportTestOptions,
  async () => {
    resetConflictTuning()

    const geography = worldDocFixture({
      gridWidth: 8,
      gridHeight: 8,
    })

    let slice = createDefaultColonizationSlice()
    slice.epoch = 7
    slice.settlements = [
      {
        id: 'att-cap',
        x: 1,
        y: 1,
        status: 'living',
        factionId: 'att',
        population: 800,
      },
      {
        id: 'def-pin',
        x: 4,
        y: 1,
        status: 'living',
        factionId: 'def',
        population: 80,
      },
    ]
    slice.factions = [
      {
        id: 'att',
        status: 'active',
        capitalSettlementId: 'att-cap',
        settlementIds: ['att-cap'],
      },
      {
        id: 'def',
        status: 'active',
        capitalSettlementId: 'def-pin',
        settlementIds: ['def-pin'],
      },
    ]
    slice.recentConquestBySettlementId = {}
    slice.warExhaustionBySettlementId = {}
    slice.belligerentTradeBlocks = []
    slice.historyLog = []

    const resolved = applyConquestResolution({
      slice,
      attackerFactionId: 'att',
      contestedSettlementId: 'def-pin',
      capacityBySettlementId: {
        'att-cap': 3000,
        'def-pin': 50,
      },
      candidateEdges: [
        {
          id: 'att-def',
          fromSettlementId: 'att-cap',
          toSettlementId: 'def-pin',
          mode: 'road',
          haulDistanceFraction: 1,
          capacityLb: 1,
          transportCostCpPerLb: 1,
          directionalFrictionAtoB: 1,
          directionalFrictionBtoA: 1,
        },
      ],
      strategicReachHaulFractions: { overland: 20, road: 20, inlandWater: 20, openSea: 20 },
    })

    assert.equal(resolved.winner, 'attacker')
    assert.ok(resolved.slice.recentConquestBySettlementId['def-pin'])
    assert.equal(resolved.slice.recentConquestBySettlementId['def-pin'].conqueredEpoch, 7)

    const worldDocument = applyColonizationSliceToWorldDocument(geography, resolved.slice)
    assert.equal(worldDocument.epoch, 7)
    assert.ok(worldDocument.recentConquestBySettlementId?.['def-pin'])

    const viewport = await createWorldBuilderMapViewport(createHostEl(), geography)
    const overlay = createOverlayOwnerDriver(viewport)
    overlay.setVisibility('settlements', true)
    overlay.setVisibility('factionTerritory', true)

    viewport.updateWorldDocument(worldDocument)

    assert.ok(
      redSwordFillCount() > 0,
      'merged conquest stamp must reach createWorldBuilderMapViewport Graphics draw',
    )

    viewport.destroy()
  },
)
