import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { runFullDerivedGeographyPipeline } from './derivedGeographyPipeline.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

const diverseBiomeParams = {
  geographySeed: 42,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('runFullDerivedGeographyPipeline includes metals raster and nodes on world document', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cellCount = params.width * params.height

  assert.ok(doc.metalsRaster)
  assert.strictEqual(doc.metalsRaster.length, cellCount)
  assert.ok(Array.isArray(doc.metalNodes))

  for (let i = 0; i < doc.metalsRaster.length; i += 1) {
    assert.ok(doc.metalsRaster[i] >= 0 && doc.metalsRaster[i] <= 1)
  }

  for (const node of doc.metalNodes) {
    assert.match(node.id, /^metal-\d+$/)
    assert.ok(Number.isInteger(node.x))
    assert.ok(Number.isInteger(node.y))
  }
})

test('runFullDerivedGeographyPipeline metal nodes are deterministic for fixed seed', () => {
  const first = runFullDerivedGeographyPipeline(params)
  const second = runFullDerivedGeographyPipeline(params)
  assert.deepStrictEqual(first.metalNodes, second.metalNodes)
  assert.deepStrictEqual(first.metalsRaster, second.metalsRaster)
})

test('runFullDerivedGeographyPipeline respects maxMetalNodes option', () => {
  const capped = runFullDerivedGeographyPipeline({
    ...params,
    options: { maxMetalNodes: 2 },
  })
  assert.ok(capped.metalNodes.length <= 2)
})

test('runFullDerivedGeographyPipeline places no metal nodes when maxMetalNodes is zero', () => {
  const doc = runFullDerivedGeographyPipeline({
    ...params,
    options: { maxMetalNodes: 0 },
  })
  assert.deepStrictEqual(doc.metalNodes, [])
})

test('runFullDerivedGeographyPipeline metals are higher in mountain biomes than grassland', () => {
  const doc = runFullDerivedGeographyPipeline(diverseBiomeParams)
  const { biomes, metalsRaster } = doc

  let mountainSum = 0
  let mountainCount = 0
  let grasslandSum = 0
  let grasslandCount = 0

  for (let i = 0; i < biomes.length; i += 1) {
    if (biomes[i] === BIOMES.MOUNTAIN) {
      mountainSum += metalsRaster[i]
      mountainCount += 1
    } else if (biomes[i] === BIOMES.GRASSLAND) {
      grasslandSum += metalsRaster[i]
      grasslandCount += 1
    }
  }

  assert.ok(mountainCount > 0)
  assert.ok(grasslandCount > 0)
  assert.ok(mountainSum / mountainCount > grasslandSum / grasslandCount + 0.05)
})
