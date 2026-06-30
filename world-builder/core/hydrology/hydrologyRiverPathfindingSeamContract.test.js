import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  RIVER_MASK_LIFECYCLE_FIELDS,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
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
  assert.match(source, /resolveDisplayRiverNetworkMask/)
  assert.match(source, /snapshotRiverMaskLifecycle/)
  assert.match(source, /RIVER_MASK_SKIP_REFINE_TRANSITION/)
  assert.doesNotMatch(source, /presentationRiverNetworkMask \?\? ctx\.settledRiverNetworkMask/)
})

test('hydrology substep contracts reference explicit river mask lifecycle fields', () => {
  const contractsSource = readFileSync(contractsPath, 'utf8')

  assert.match(contractsSource, /riverMaskLifecycle/)
  assert.strictEqual(RIVER_MASK_LIFECYCLE_FIELDS.sketch, 'riverNetworkMask')
  assert.strictEqual(RIVER_MASK_LIFECYCLE_FIELDS.incised, 'incisedCorridorMask')
  assert.strictEqual(RIVER_MASK_SKIP_REFINE_TRANSITION, 'skipRefine')
})
