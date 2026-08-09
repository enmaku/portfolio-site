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
  shouldShowValidationFailureIndicator,
  isGenerationRunSuccess,
  WORLD_BUILDER_VALIDATION_EXHAUSTED_INDICATOR_TEST_ID,
} from './worldBuilderPageModel.js'
import { shouldApplyStepPreviewToMap } from './worldBuilderGenerationPolicy.js'
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
  for (const runPhase of ['idle', 'running', 'success', 'exhausted', 'cancelled', 'error']) {
    const showProgress = shouldShowGenerationProgress(runPhase)
    const showOverlayBar = shouldShowResourceOverlayBar(runPhase)
    assert.strictEqual(showProgress && showOverlayBar, false)
  }
})

test('validation exhausted indicator test id is wired to exhausted-only presentation helpers', () => {
  assert.strictEqual(typeof WORLD_BUILDER_VALIDATION_EXHAUSTED_INDICATOR_TEST_ID, 'string')
  assert.ok(WORLD_BUILDER_VALIDATION_EXHAUSTED_INDICATOR_TEST_ID.includes('validation'))
  assert.strictEqual(shouldShowValidationFailureIndicator('exhausted'), true)
  assert.strictEqual(shouldShowValidationFailureIndicator('success'), false)
  assert.strictEqual(isGenerationRunSuccess('exhausted'), false)
  assert.strictEqual(shouldShowResourceOverlayBar('exhausted'), false)
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: {
        gridWidth: 4,
        gridHeight: 4,
        biomes: new Uint8Array(16),
        fields: { elevation: new Float32Array(16) },
      },
    }),
    true,
  )
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

test(
  'default generation smoke on 128 grid completes full pipeline without hydrology mocks',
  { timeout: 60_000 },
  () => {
    const controls = createDefaultControlsState()
    const params = buildDerivedGeographyParams(
      controls.geographySeed,
      controls.prevailingWindDegrees,
      controls.generationOptions,
    )
    const gridSize = 128
    const cellCount = gridSize * gridSize
    const startedAt = performance.now()

    const doc = generateDerivedGeography({
      ...params,
      width: gridSize,
      height: gridSize,
    })

    const elapsedMs = performance.now() - startedAt
    assert.ok(
      elapsedMs < 60_000,
      `expected default generation under 60s, took ${Math.round(elapsedMs)}ms`,
    )

    assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_DERIVED_GEOGRAPHY)
    assert.strictEqual(doc.gridWidth, gridSize)
    assert.strictEqual(doc.gridHeight, gridSize)
    assert.strictEqual(doc.fields.elevation.length, cellCount)
    assert.ok(doc.riverGraph)
    assert.ok(doc.riverNetworkMask)
    assert.ok(doc.lakeMask)

    assert.ok(doc.simulationRiverMask)
    assert.strictEqual(doc.simulationRiverMask.length, cellCount)
    let simulationRiverCellCount = 0
    for (let i = 0; i < doc.simulationRiverMask.length; i += 1) {
      if (doc.simulationRiverMask[i]) simulationRiverCellCount += 1
    }
    assert.ok(
      simulationRiverCellCount > 0,
      'expected simulationRiverMask populated after hydrology',
    )

    assert.ok(doc.displayBiomes)
    assert.strictEqual(doc.displayBiomes.length, cellCount)
    let displayBiomeKindCount = 0
    for (let i = 0; i < doc.displayBiomes.length; i += 1) {
      if (doc.displayBiomes[i] !== 0) displayBiomeKindCount += 1
    }
    assert.ok(displayBiomeKindCount > 0, 'expected displayBiomes populated for terrain tint')

    assert.ok(doc.generationReport)
    assert.ok(Array.isArray(doc.generationReport.validationRows))
    assert.ok(doc.generationReport.validationRows.length > 0)
    for (const row of doc.generationReport.validationRows) {
      assert.strictEqual(typeof row.checkId, 'string')
      assert.strictEqual(typeof row.status, 'string')
      assert.ok(row.summary.length > 0)
    }
    assert.ok(doc.generationReport.hydrology)
    assert.ok(doc.generationReport.hydrology.riverCellCount > 0)
    assert.strictEqual(typeof doc.generationReport.shouldReject, 'boolean')
    assert.ok(Array.isArray(doc.generationReport.rejectionReasons))
    assert.ok(doc.generationReport.validationSignals)
  },
)
