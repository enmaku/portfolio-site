import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { strategicResourceNodeSpacingForGrid } from '../resourcePlacementScaling.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { runResourceValidationChecks } from './runResourceValidationChecks.js'

/**
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {import('../types.js').SaltNode[]} [params.saltNodes]
 * @param {import('../types.js').MetalNode[]} [params.metalNodes]
 * @param {Float32Array} [params.arableRaster]
 * @param {Float32Array} [params.elevation]
 * @param {Uint8Array} [params.biomes]
 */
function makeResourceWorldDocumentFixture({
  width,
  height,
  saltNodes = [],
  metalNodes = [],
  arableRaster,
  elevation,
  biomes,
}) {
  const cellCount = width * height
  const resolvedElevation = elevation ?? new Float32Array(cellCount).fill(SEA_LEVEL + 0.3)
  const resolvedBiomes = biomes ?? new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  const resolvedArable = arableRaster ?? new Float32Array(cellCount).fill(0.4)

  return {
    geographySeed: 42,
    gridWidth: width,
    gridHeight: height,
    saltNodes,
    metalNodes,
    arableRaster: resolvedArable,
    fields: {
      elevation: resolvedElevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.5),
      drainage: new Float32Array(cellCount).fill(0.5),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: resolvedBiomes,
    validationOptions: DEFAULT_WORLD_GENERATION_OPTIONS,
  }
}

test('runResourceValidationChecks returns resource check ids in stable order', () => {
  const fixture = makeResourceWorldDocumentFixture({ width: 16, height: 16 })
  const rows = runResourceValidationChecks(fixture)
  assert.deepStrictEqual(
    rows.map((row) => row.checkId),
    ['arableEnvelopeCoverage', 'saltNodeLandProximity', 'strategicResourceSpacing'],
  )
})

test('runResourceValidationChecks passes arable envelope for productive land layout', () => {
  const fixture = makeResourceWorldDocumentFixture({ width: 16, height: 16 })
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'arableEnvelopeCoverage',
  )
  assert.strictEqual(row?.status, 'pass')
  assert.strictEqual(row?.category, 'resources')
  assert.strictEqual(row?.rejectable, false)
})

test('runResourceValidationChecks warns on thin arable envelope', () => {
  const width = 16
  const height = 16
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount)
  arableRaster[100] = 0.5
  const fixture = makeResourceWorldDocumentFixture({ width, height, arableRaster })
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'arableEnvelopeCoverage',
  )
  assert.strictEqual(row?.status, 'warn')
  assert.ok(row?.mapFocus)
})

test('runResourceValidationChecks warns on salt node land proximity violations', () => {
  const width = 48
  const height = 48
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.GRASSLAND
  const fixture = makeResourceWorldDocumentFixture({
    width,
    height,
    biomes,
    saltNodes: [{ id: 'salt-0', x: 24, y: 24, score: 0.9 }],
  })
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'saltNodeLandProximity',
  )
  assert.strictEqual(row?.status, 'warn')
  assert.strictEqual(row?.rejectable, true)
  assert.ok(row?.mapFocus)
})

test('runResourceValidationChecks hard-fails saltNodeLandProximity when enforced', () => {
  const width = 48
  const height = 48
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.GRASSLAND
  const fixture = makeResourceWorldDocumentFixture({
    width,
    height,
    biomes,
    saltNodes: [{ id: 'salt-0', x: 24, y: 24, score: 0.9 }],
  })
  fixture.validationOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enforceSaltNodeLandProximity: true,
  }
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'saltNodeLandProximity',
  )
  assert.strictEqual(row?.status, 'fail')
})

test('runResourceValidationChecks warns on strategic resource spacing violations', () => {
  const gridSize = 256
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)
  const fixture = makeResourceWorldDocumentFixture({
    width: gridSize,
    height: gridSize,
    saltNodes: [
      { id: 'salt-0', x: 40, y: 40, score: 0.9 },
      { id: 'salt-1', x: 40 + minSpacing - 2, y: 40, score: 0.85 },
    ],
  })
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'strategicResourceSpacing',
  )
  assert.strictEqual(row?.status, 'warn')
  assert.strictEqual(row?.rejectable, true)
})

test('runResourceValidationChecks hard-fails strategicResourceSpacing when enforced', () => {
  const gridSize = 256
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)
  const fixture = makeResourceWorldDocumentFixture({
    width: gridSize,
    height: gridSize,
    metalNodes: [
      { id: 'metal-0', x: 80, y: 80, score: 0.9 },
      { id: 'metal-1', x: 80 + minSpacing - 2, y: 80, score: 0.85 },
    ],
  })
  fixture.validationOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enforceStrategicResourceSpacing: true,
  }
  const row = runResourceValidationChecks(fixture).find(
    (entry) => entry.checkId === 'strategicResourceSpacing',
  )
  assert.strictEqual(row?.status, 'fail')
})

test('runResourceValidationChecks skips unavailable resource outputs with pass rows', () => {
  const rows = runResourceValidationChecks({
    fields: {
      elevation: new Float32Array(16).fill(SEA_LEVEL + 0.3),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.5),
      drainage: new Float32Array(16).fill(0.5),
      salinity: new Float32Array(16).fill(0.1),
    },
    biomes: new Uint8Array(16).fill(BIOMES.GRASSLAND),
    gridWidth: 4,
    gridHeight: 4,
    validationOptions: DEFAULT_WORLD_GENERATION_OPTIONS,
  })
  assert.ok(rows.every((row) => row.status === 'pass'))
})
