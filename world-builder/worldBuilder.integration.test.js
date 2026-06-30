import assert from 'node:assert/strict'
import test from 'node:test'
import routes from '../src/router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../src/share-metadata.js'
import { DERIVED_GEOGRAPHY_STEPS } from './core/derivedGeographyPipeline.js'
import { generateDerivedGeography } from './core/generateDerivedGeography.js'
import { PIPELINE_STAGE_DERIVED_GEOGRAPHY } from './core/types.js'
import {
  buildDerivedGeographyParams,
  createDefaultControlsState,
  shouldShowGenerationProgress,
  shouldShowResourceOverlayBar,
} from './worldBuilderPageModel.js'
import {
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
} from './worldBuilderGenerationControls.js'

const WORLD_BUILDER_PATH = '/projects/world-builder'

/**
 * @returns {string[]}
 */
function collectGenerationControlTestIds() {
  return WORLD_BUILDER_GENERATION_CONTROL_SECTIONS.flatMap((section) =>
    section.controls.map((control) => control.testId),
  )
}

/**
 * @param {string} key
 */
function findGenerationControlByKey(key) {
  for (const section of WORLD_BUILDER_GENERATION_CONTROL_SECTIONS) {
    const control = section.controls.find((entry) => entry.key === key)
    if (control) return control
  }
  return undefined
}

test('world builder route is a MainLayout child', () => {
  const mainLayout = routes.find((entry) => entry.path === '/')
  assert.ok(mainLayout)
  const worldBuilderRoute = mainLayout.children?.find(
    (child) => child.path === 'projects/world-builder',
  )
  assert.ok(worldBuilderRoute)
  assert.match(String(worldBuilderRoute.component), /WorldBuilderPage\.vue/)
})

test('world builder route is not under ProjectShellLayout', () => {
  const shellRoute = routes.find((entry) => entry.path === '/projects/world-builder')
  assert.strictEqual(shellRoute, undefined)
})

test('world builder share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath(WORLD_BUILDER_PATH)
  assert.ok(entry)
  assert.strictEqual(entry.pasteUnfurl, true)
  assert.strictEqual(entry.routePath, WORLD_BUILDER_PATH)
  assert.strictEqual(entry.title.includes('—'), false)
  assert.strictEqual(PASTE_UNFURL_ROUTES.some((row) => row.routePath === WORLD_BUILDER_PATH), true)
})

test('generation control catalog exposes unique stable test ids', () => {
  const testIds = collectGenerationControlTestIds()
  assert.ok(testIds.includes('world-builder-wind-slider'))
  assert.ok(testIds.includes('world-builder-control-sea-level'))
  assert.ok(testIds.includes('world-builder-control-max-metal-nodes'))
  assert.strictEqual(new Set(testIds).size, testIds.length)
})

test('generation control catalog wires stream-power and hydrology knobs by key', () => {
  assert.strictEqual(findGenerationControlByKey('inciseIterations')?.testId, 'world-builder-control-incise-iterations')
  assert.strictEqual(findGenerationControlByKey('streamPowerK')?.testId, 'world-builder-control-stream-power-k')
  assert.strictEqual(findGenerationControlByKey('channelInitiationThreshold')?.testId, 'world-builder-control-channel-initiation')
})

test('default controls state builds worker-ready derived geography params', () => {
  const controls = createDefaultControlsState()
  const params = buildDerivedGeographyParams(
    controls.geographySeed,
    controls.prevailingWindDegrees,
    controls.generationOptions,
  )

  assert.strictEqual(typeof params.geographySeed, 'number')
  assert.strictEqual(typeof params.prevailingWindDegrees, 'number')
  assert.ok(params.options)
  assert.ok(DERIVED_GEOGRAPHY_STEPS.length > 0)
})


test('status bar helpers never show progress and overlay bar together', () => {
  for (const isGenerating of [true, false]) {
    for (const pipelineSucceeded of [true, false]) {
      const showProgress = shouldShowGenerationProgress(isGenerating)
      const showOverlayBar = shouldShowResourceOverlayBar(isGenerating, pipelineSucceeded)
      assert.strictEqual(showProgress && showOverlayBar, false)
    }
  }
})

test('generateDerivedGeography on tiny grid completes landmass pipeline outputs', () => {
  const doc = generateDerivedGeography({
    geographySeed: 1,
    prevailingWindDegrees: 45,
    width: 8,
    height: 8,
  })

  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_DERIVED_GEOGRAPHY)
  assert.strictEqual(doc.fields.temperature.length, 64)
  assert.strictEqual(doc.coastNavigability.length, 64)
  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.generationReport)
})
