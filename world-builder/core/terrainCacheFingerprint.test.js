import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTerrainCacheFingerprint,
  stripColonizationFromWorldDocument,
} from './terrainCacheFingerprint.js'

test('buildTerrainCacheFingerprint is stable for the same inputs', () => {
  const input = {
    geographySeed: 7,
    prevailingWindDegrees: 90,
    generationOptions: { seaLevel: 0.3, elevationScale: 1 },
  }
  assert.strictEqual(buildTerrainCacheFingerprint(input), buildTerrainCacheFingerprint(input))
})

test('buildTerrainCacheFingerprint changes when seed or options change', () => {
  const base = {
    geographySeed: 7,
    prevailingWindDegrees: 90,
    generationOptions: { seaLevel: 0.3 },
  }
  assert.notStrictEqual(
    buildTerrainCacheFingerprint(base),
    buildTerrainCacheFingerprint({ ...base, geographySeed: 8 }),
  )
  assert.notStrictEqual(
    buildTerrainCacheFingerprint(base),
    buildTerrainCacheFingerprint({
      ...base,
      generationOptions: { seaLevel: 0.4 },
    }),
  )
})

test('stripColonizationFromWorldDocument removes colonization fields only', () => {
  const doc = {
    geographySeed: 1,
    gridWidth: 2,
    colonizationPhase: 'setup',
    foundingLanding: { x: 1, y: 1 },
    settlements: [{ id: 's1' }],
  }
  const stripped = stripColonizationFromWorldDocument(doc)
  assert.strictEqual(stripped.geographySeed, 1)
  assert.strictEqual(stripped.colonizationPhase, undefined)
  assert.strictEqual(stripped.foundingLanding, undefined)
  assert.strictEqual(stripped.settlements, undefined)
  assert.strictEqual(doc.colonizationPhase, 'setup')
})
