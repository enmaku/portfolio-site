import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { createDefaultColonizationSlice } from '../colonization/createDefaultColonizationSlice.js'
import { buildCampaignKitModel } from './buildCampaignKitModel.js'
import { campaignKitFilename } from './campaignKitFilename.js'
import {
  CAMPAIGN_KIT_MAP_PAGE_KEYS,
  campaignKitResourcesMapVisibility,
  campaignKitSettlementsMapVisibility,
} from './campaignKitOverlayPresets.js'

test('campaignKitFilename encodes seed and epoch', () => {
  assert.equal(
    campaignKitFilename({ geographySeed: 42, epoch: 7 }),
    'campaign-kit-seed-42-epoch-7.pdf',
  )
  assert.equal(
    campaignKitFilename({ geographySeed: 'abc', epoch: Number.NaN }),
    'campaign-kit-seed-abc-epoch-0.pdf',
  )
})

test('campaign kit overlay presets enable only the page overlays', () => {
  const settlements = campaignKitSettlementsMapVisibility()
  assert.equal(settlements.settlements, true)
  assert.equal(settlements.routes, true)
  assert.equal(settlements.arable, false)
  assert.equal(settlements.explorationFog, false)
  assert.equal(settlements.wealth, false)

  const resources = campaignKitResourcesMapVisibility()
  assert.equal(resources.arable, true)
  assert.equal(resources.timber, true)
  assert.equal(resources.metals, true)
  assert.equal(resources.salt, true)
  assert.equal(resources.settlements, false)
  assert.equal(resources.routes, false)
})

test('buildCampaignKitModel sorts dossiers by map number and stubs ruins', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = 'running'
  slice.epoch = 3
  slice.foundingLanding = { x: 1, y: 1 }
  slice.historyLog = [
    { kind: 'founding', epoch: 0 },
    { kind: 'settlement_founded', epoch: 1, settlementId: 'b' },
    { kind: 'settlement_abandoned', epoch: 2, settlementId: 'b' },
  ]
  slice.settlements = [
    {
      id: 'b',
      x: 2,
      y: 0,
      mapNumber: 2,
      status: 'ruin',
      population: 0,
      tier: null,
      foundedEpoch: 1,
      originSettlementId: 'a',
    },
    {
      id: 'a',
      x: 0,
      y: 0,
      mapNumber: 1,
      status: 'living',
      population: 120,
      tier: 'outpost',
      maritimeRole: 'port',
      foundedEpoch: 0,
    },
  ]
  slice.externalTradeAccounts = { a: 50 }
  slice.lastTradeEpochResult = {
    tradeAccounts: { balancesBySettlementId: { a: 10 } },
    settlementCommodityRoles: { a: { grain: 'export' } },
    localPricesBySettlementId: { a: { grain: 1 } },
    offMapTrades: [
      {
        settlementId: 'a',
        commodityId: 'grain',
        direction: 'export',
        amount: 100,
        unitPriceCp: 1,
      },
    ],
  }
  slice.primaryClaim = { a: [{ x: 0, y: 0 }] }

  const biomes = new Uint8Array(4)
  biomes[0] = BIOMES.GRASSLAND
  biomes[2] = BIOMES.DESERT
  const worldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    geographySeed: 99,
    biomes,
    saltNodes: [],
    metalNodes: [],
    fields: { elevation: new Float32Array(4) },
  }

  const model = buildCampaignKitModel(slice, worldDocument)

  assert.equal(model.header.epoch, 3)
  assert.equal(model.header.livingSettlementCount, 1)
  assert.equal(model.header.ruinCount, 1)
  assert.equal(model.header.geographySeed, 99)
  assert.deepEqual(model.header.foundingLanding, { x: 1, y: 1 })
  assert.equal(model.header.colonistSettings.yieldModifier, 'typical')
  assert.deepEqual(model.mapPageKeys, [...CAMPAIGN_KIT_MAP_PAGE_KEYS])

  assert.equal(model.settlements.length, 2)
  assert.equal(model.settlements[0].mapNumber, 1)
  assert.equal(model.settlements[0].status, 'living')
  assert.equal(model.settlements[0].biomeLabel, 'Grassland')
  assert.equal(model.settlements[0].maritimeRole, 'port')
  assert.ok(model.settlements[0].balance)
  assert.ok(Array.isArray(model.settlements[0].commodities))
  assert.ok(model.settlements[0].commodities.some((row) => row.commodityId === 'grain'))
  assert.equal(model.settlements[0].offMapTrades?.length, 1)
  assert.equal(model.settlements[0].offMapTrades?.[0].label, 'grain')
  assert.equal(model.settlements[0].offMapTrades?.[0].amount, 100)
  assert.ok(model.settlements[0].offMapTrades?.[0].amountDisplay.includes('lb'))
  assert.ok(model.settlements[0].historyNotes.some((note) => note.label === 'founding'))
  assert.ok(
    model.settlements[0].commodities?.some(
      (row) => row.commodityId === 'grain' && row.label === 'grain',
    ),
  )

  assert.equal(model.settlements[1].mapNumber, 2)
  assert.equal(model.settlements[1].status, 'ruin')
  assert.equal(model.settlements[1].biomeLabel, 'Desert')
  assert.equal(model.settlements[1].originMapNumber, 1)
  assert.equal(model.settlements[1].commodities, null)
  assert.equal(model.settlements[1].balance, null)
  assert.ok(
    model.settlements[1].historyNotes.some((note) => note.label === 'settlement abandoned'),
  )
  assert.ok(
    model.settlements[1].historyNotes.some((note) => note.label === 'settlement founded'),
  )
})

