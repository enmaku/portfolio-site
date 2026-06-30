import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rendererDir = fileURLToPath(new URL('.', import.meta.url))

const legacyTestOnlyRendererModules = new Set(['smoothRiverBiomeEdgesInRgba.js'])

/** Production renderer modules (exclude *.test.js and legacy test-only helpers). */
const productionRendererSources = readdirSync(rendererDir)
  .filter(
    (name) =>
      name.endsWith('.js') &&
      !name.endsWith('.test.js') &&
      !legacyTestOnlyRendererModules.has(name),
  )
  .map((name) => join(rendererDir, name))

const forbiddenCoreImports = [
  'classifyBiomesFromFields',
  'classifyBiomeFromSample',
  'classifyBiomesWithHydrology',
]

const legacyBiomeRiverSmoothingCalls = [
  /\bsmoothRiverBiomeEdgesInRgba\s*\(/,
  /\bcomputeRiverOverlayAlpha\s*\(/,
]

test('renderer production modules do not import biome classification from core', () => {
  for (const path of productionRendererSources) {
    const source = readFileSync(path, 'utf8')
    for (const symbol of forbiddenCoreImports) {
      assert.ok(
        !source.includes(symbol),
        `${path} must not import ${symbol} — use displayBiomes palette lookup per ADR-0009`,
      )
    }
  }
})

test('renderer production modules do not call legacy biome river smoothing', () => {
  for (const path of productionRendererSources) {
    const source = readFileSync(path, 'utf8')
    for (const pattern of legacyBiomeRiverSmoothingCalls) {
      assert.ok(
        !pattern.test(source),
        `${path} must not call legacy biome river smoothing — use hydrology corridor overlay`,
      )
    }
  }
})

test('terrain raster builders read displayBiomes only', () => {
  for (const name of ['buildLandTerrainRgba.js', 'biomeIndicesToRgba.js']) {
    const source = readFileSync(join(rendererDir, name), 'utf8')
    assert.ok(source.includes('displayBiomes'), `${name} must tint from displayBiomes`)
    assert.ok(!source.includes('worldDocument.biomes'), `${name} must not read simulation biomes`)
  }
})
