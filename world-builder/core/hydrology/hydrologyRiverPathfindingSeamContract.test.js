import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import {
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  riverMaskContractKey,
} from './riverMaskLifecycle.js'

const hydrologyDir = fileURLToPath(new URL('.', import.meta.url))

const pathfindingPath = join(hydrologyDir, 'riverPathfinding.js')
const attractionPath = join(hydrologyDir, 'connectNearbyRiverCorridors.js')
const refinePath = join(hydrologyDir, 'refineRiverNetwork.js')
const substepsPath = join(hydrologyDir, 'hydrologySubsteps.js')
const contractsPath = join(hydrologyDir, 'hydrologySubstepContracts.js')

test('legacy corridor routers delegate fractal routing to riverPathfinding only', () => {
  const attractionSource = readFileSync(attractionPath, 'utf8')
  const refineSource = readFileSync(refinePath, 'utf8')

  assert.match(attractionSource, /routeFractalCorridorPath/)
  assert.match(refineSource, /routeFractalCorridorPath/)
  assert.doesNotMatch(attractionSource, /function buildFractalWaypoints/)
  assert.doesNotMatch(refineSource, /function buildFractalWaypoints/)
  assert.doesNotMatch(attractionSource, /function fallbackLine/)
  assert.doesNotMatch(refineSource, /function fallbackLine/)
})

test('riverPathfinding exports shared fractal corridor routing entry point', () => {
  const source = readFileSync(pathfindingPath, 'utf8')

  assert.match(source, /export function routeFractalCorridorPath/)
  assert.match(source, /legacyAttraction/)
  assert.match(source, /meanderRefine/)
})

test('hydrologySubsteps uses named mask lifecycle helpers instead of inline fallbacks', () => {
  const source = readFileSync(substepsPath, 'utf8')

  assert.match(source, /applySkipRefineTransition/)
  assert.match(source, /resolveDisplayRiverNetworkMaskFromPipeline/)
  assert.match(source, /snapshotRiverMaskLifecycle/)
  assert.match(source, /getRiverMaskStageFromContext|requireRiverMaskStageFromContext/)
  assert.match(source, /RIVER_MASK_SKIP_REFINE_TRANSITION/)
  assert.doesNotMatch(source, /presentationRiverNetworkMask \?\? ctx\.settledRiverNetworkMask/)
  assert.doesNotMatch(source, /riverMaskPipeline\.(sketch|incised|settled|presentation|painted)/)
})

test('hydrology substep contracts reference explicit river mask lifecycle fields', () => {
  const contractsSource = readFileSync(contractsPath, 'utf8')

  assert.match(contractsSource, /riverMaskLifecycle/)
  assert.match(contractsSource, /riverMaskContractKey\('sketch'\)/)
  assert.match(contractsSource, /riverMaskContractKey\('incised'\)/)
  assert.strictEqual(riverMaskContractKey('sketch'), 'riverMask.sketch')
  assert.strictEqual(riverMaskContractKey('incised'), 'riverMask.incised')
  assert.strictEqual(RIVER_MASK_SKIP_REFINE_TRANSITION, 'skipRefine')
})

test('issue #345 Option A defaults keep legacy presentation heuristics off', () => {
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.riverAttractionRadiusScale, 0)
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.enableMeanderRefine, false)

  const optionsSource = readFileSync(
    join(fileURLToPath(new URL('..', import.meta.url)), 'worldGenerationOptions.js'),
    'utf8',
  )
  assert.match(optionsSource, /Option A/)
})

test('default generation exports simulation centerline and presentation corridor mask', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.riverCorridorMask)

  const centerlineCount = doc.riverNetworkMask.reduce((sum, value) => sum + value, 0)
  const corridorCount = doc.riverCorridorMask.reduce((sum, value) => sum + value, 0)

  assert.ok(centerlineCount > 0, 'default simulation path should produce river centerline cells')
  assert.ok(
    corridorCount >= centerlineCount,
    'presentation corridor should cover at least the centerline',
  )
  assert.notStrictEqual(doc.riverCorridorMask, doc.riverNetworkMask)
})
