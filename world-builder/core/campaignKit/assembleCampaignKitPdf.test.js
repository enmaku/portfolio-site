import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
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

test('assembleCampaignKitPdf fits non-square map images without distortion errors', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 1
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
  const widePngBuffer = await sharp({
    create: { width: 400, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer()
  const widePng = new Blob([widePngBuffer], { type: 'image/png' })
  const pdf = await assembleCampaignKitPdf({
    model,
    settlementsMapPng: widePng,
    resourcesMapPng: widePng,
  })
  assert.equal(pdf.type, 'application/pdf')
  assert.ok(pdf.size > 100)
})
