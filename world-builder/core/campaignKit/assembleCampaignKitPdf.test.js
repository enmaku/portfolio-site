import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleCampaignKitPdf } from './assembleCampaignKitPdf.js'
import { buildCampaignKitModel } from './buildCampaignKitModel.js'
import { createDefaultColonizationSlice } from '../colonization/createDefaultColonizationSlice.js'

/** 1×1 transparent PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test('assembleCampaignKitPdf returns a non-empty pdf blob', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 1
  slice.settlements = [
    {
      id: 'a',
      x: 0,
      y: 0,
      mapNumber: 1,
      status: 'living',
      population: 10,
      tier: 'outpost',
      maritimeRole: 'none',
    },
  ]
  const worldDocument = {
    gridWidth: 1,
    gridHeight: 1,
    geographySeed: 1,
    biomes: new Uint8Array([2]),
    saltNodes: [],
    metalNodes: [],
    fields: { elevation: new Float32Array(1) },
  }
  const model = buildCampaignKitModel(slice, worldDocument)
  const png = new Blob([TINY_PNG], { type: 'image/png' })
  const pdf = await assembleCampaignKitPdf({
    model,
    settlementsMapPng: png,
    resourcesMapPng: png,
  })
  assert.equal(pdf.type, 'application/pdf')
  assert.ok(pdf.size > 100)
})
