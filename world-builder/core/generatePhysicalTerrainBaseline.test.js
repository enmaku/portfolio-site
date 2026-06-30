import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { DEFAULT_GRID_SIZE, PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE } from './types.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('generatePhysicalTerrainBaseline defaults to 1024 grid', () => {
  const doc = generatePhysicalTerrainBaseline({
    geographySeed: 42,
    prevailingWindDegrees: 180,
  })
  assert.strictEqual(doc.gridWidth, DEFAULT_GRID_SIZE)
  assert.strictEqual(doc.gridHeight, DEFAULT_GRID_SIZE)
  assert.strictEqual(DEFAULT_GRID_SIZE, 1024)
})
test('generatePhysicalTerrainBaseline records physical terrain baseline stage metadata', () => {
  const doc = generatePhysicalTerrainBaseline(params)

  assert.strictEqual(doc.gridWidth, 256)
  assert.strictEqual(doc.gridHeight, 256)
  assert.strictEqual(doc.geographySeed, 12345)
  assert.strictEqual(doc.prevailingWindDegrees, 90)
  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE)
})

test('generatePhysicalTerrainBaseline is deterministic for same seed and wind', () => {
  const first = generatePhysicalTerrainBaseline(params)
  const second = generatePhysicalTerrainBaseline(params)

  assert.deepStrictEqual(first.biomes, second.biomes)
  assert.deepStrictEqual(first.fields.elevation, second.fields.elevation)
  assert.deepStrictEqual(first.fields.rainfall, second.fields.rainfall)
  assert.deepStrictEqual(first.fields.salinity, second.fields.salinity)
})

test('generatePhysicalTerrainBaseline differs for different seeds', () => {
  const first = generatePhysicalTerrainBaseline(params)
  const second = generatePhysicalTerrainBaseline({ ...params, geographySeed: 99999 })

  let same = true
  for (let i = 0; i < first.biomes.length; i += 1) {
    if (first.biomes[i] !== second.biomes[i]) {
      same = false
      break
    }
  }
  assert.strictEqual(same, false)
})

test('generatePhysicalTerrainBaseline emits closed island rim ocean at corners', () => {
  const doc = generatePhysicalTerrainBaseline(params)
  const { gridWidth: w, gridHeight: h, biomes } = doc

  assert.strictEqual(biomes[0], 0)
  assert.strictEqual(biomes[w - 1], 0)
  assert.strictEqual(biomes[(h - 1) * w], 0)
  assert.strictEqual(biomes[h * w - 1], 0)
})

test('generatePhysicalTerrainBaseline temperature rises toward equator on default seed', () => {
  const doc = generatePhysicalTerrainBaseline({ ...params, width: 32, height: 32 })
  const { gridWidth: w, fields } = doc
  const north = fields.temperature[Math.floor(w / 2)]
  const equator = fields.temperature[16 * w + Math.floor(w / 2)]
  const south = fields.temperature[(32 - 1) * w + Math.floor(w / 2)]

  assert.ok(north < equator)
  assert.ok(south < equator)
})

test('generatePhysicalTerrainBaseline scalar fields include salinity contract key', () => {
  const doc = generatePhysicalTerrainBaseline({ ...params, width: 32, height: 32 })
  assert.deepStrictEqual(Object.keys(doc.fields).sort(), [
    'drainage',
    'elevation',
    'rainfall',
    'salinity',
    'temperature',
  ])
})

test('generatePhysicalTerrainBaseline salinity shifts with custom sea level', () => {
  const small = { ...params, width: 32, height: 32 }
  const defaultDoc = generatePhysicalTerrainBaseline(small)
  const raisedSea = generatePhysicalTerrainBaseline({
    ...small,
    options: { seaLevel: 0.5 },
  })

  let differs = false
  for (let i = 0; i < defaultDoc.fields.salinity.length; i += 1) {
    if (defaultDoc.fields.salinity[i] !== raisedSea.fields.salinity[i]) {
      differs = true
      break
    }
  }
  assert.strictEqual(differs, true)
})
