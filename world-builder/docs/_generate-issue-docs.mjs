#!/usr/bin/env node
/**
 * One-shot generator for Phase 5 issue plan + subagent prompt pairs (#355–#386).
 * Run: node world-builder/docs/_generate-issue-docs.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const plansDir = join(__dirname, 'plans')
const promptsDir = join(__dirname, 'SUBAGENT-WAVE-PROMPTS')

mkdirSync(plansDir, { recursive: true })
mkdirSync(promptsDir, { recursive: true })

const REPO = 'https://github.com/enmaku/portfolio-site'
const COMMON_READING = [
  'world-builder/docs/SUBAGENT-OPERATING-MODEL.md',
  'world-builder/docs/REWORK-PROTOCOL.md',
  'world-builder/docs/MINI-REVIEW-RUBRICS.md',
  'world-builder/docs/PHASE-5-MASTER-PLAN.md',
]

/** @type {Record<number, { blockedBy: number[], blocks: number[], sliceType: string, reading: string[], mayTouch: string[], mustNotTouch: string[], steps: string[], tests: string[], greps?: string[], acceptance: string[] }>} */
const ISSUES = {
  355: {
    blockedBy: [],
    blocks: [356, 357, 358, 376],
    sliceType: 'hydrology-type',
    reading: [
      'world-builder/docs/HYDROLOGY-TYPED-STAGES.md',
      'world-builder/docs/RIVER-MASK-LIFECYCLE.md',
      'world-builder/docs/FLOW-FIELD-INVARIANTS.md',
    ],
    mayTouch: [
      'world-builder/core/hydrology/hydrologyWorldTypes.js',
      'world-builder/core/hydrology/substeps/moduleTypes.js',
      'world-builder/core/hydrology/hydrologySubsteps.js',
      'world-builder/core/hydrology/buildPipelineStateFromHydrologyWorld.js',
      'world-builder/core/hydrology/hydrologySubstepContracts.js',
      'world-builder/core/hydrology/hydrologySubstepModules.js',
      'world-builder/core/hydrology/hydrologySubsteps.test.js',
      'world-builder/core/hydrology/hydrologySubstepContracts.test.js',
    ],
    mustNotTouch: [
      'world-builder/renderer/**',
      'src/pages/projects/WorldBuilderPage.vue',
      'world-builder/core/derivedGeographyPipeline.js',
    ],
    steps: [
      '355.1 — Create `hydrologyWorldTypes.js` with staged typedefs and `createInitialHydrologyWorld`; zero `Record<string, unknown>`.',
      '355.2 — Redefine `HydrologySubstepModule` in `substeps/moduleTypes.js` with typed generics; no `any` on public `run`.',
      '355.3 — Update `selectHydrologySubstepInput` to use narrow selectors at module boundaries.',
      '355.4 — Refactor runner in `hydrologySubsteps.js` to fold typed stages; keep skip paths and defaults.',
      '355.5 — Extract `buildPipelineStateFromHydrologyWorld.js`; input type is `HydrologyAfterPaint`.',
      '355.6 — Fix contract derivation for pipeline-mutated mask keys; keep derived-only contracts.',
      '355.7 — Remove god-bag typedef from legacy modules file; grep gate clean.',
      '355.8 — Parent integration: full `npm run test:world-builder`; eslint on all touched files.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js',
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js',
      'npm run test:world-builder',
    ],
    greps: [
      "rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'",
    ],
    acceptance: [
      'No `HydrologyWorld & Record<string, unknown>` (or equivalent god-bag) remains in the hydrology runner composition.',
      "Each substep module's `inputs` selectors and `run` function are typed against explicit stage types (no `Record<string, any>` on the public substep interface).",
      '`selectHydrologySubstepInput` (or successor) is type-safe at the module boundary.',
      '`buildPipelineStateFromHydrologyWorld` (or successor) reads only typed stage outputs.',
      '`hydrologySubstepContracts` remains derived from module metadata without a parallel manual key table.',
      '`npm run test:world-builder` passes; eslint clean on changed files.',
    ],
  },
  356: {
    blockedBy: [355],
    blocks: [357, 358, 372, 376],
    sliceType: 'hydrology-file-split',
    reading: [
      'world-builder/docs/HYDROLOGY-SUBSTEP-FILE-MAP.md',
      'world-builder/docs/HYDROLOGY-TYPED-STAGES.md',
      'world-builder/docs/hydrology/substep-specs/SUBSTEP-hydrologyFill.md',
    ],
    mayTouch: [
      'world-builder/core/hydrology/substeps/**',
      'world-builder/core/hydrology/hydrologySubstepModules.js',
      'world-builder/core/hydrology/baselineDrainageFromState.js',
      'world-builder/core/hydrology/hydrologySubsteps.test.js',
      'world-builder/core/hydrology/hydrologySubstepModules.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**', 'world-builder/core/derivedGeographyPipeline.js'],
    steps: [
      '356.1 — Extract `substeps/hydrologyFillSubstep.js` (≤250 lines).',
      '356.2 — Extract `substeps/hydrologyClimateSubstep.js` (≤200 lines).',
      '356.3 — Extract `substeps/hydrologySeasonalSubstep.js` (≤200 lines).',
      '356.4 — Extract `substeps/hydrologyRouteSubstep.js` (≤250 lines).',
      '356.5 — Extract `substeps/hydrologyInciseSubstep.js` (≤200 lines).',
      '356.6 — Extract `substeps/hydrologyExtractSubstep.js` (≤200 lines).',
      '356.7 — Extract `substeps/hydrologyRefineSubstep.js` (≤200 lines).',
      '356.8 — Extract `substeps/hydrologySettleSubstep.js` (≤250 lines).',
      '356.9 — Extract `substeps/hydrologyPaintSubstep.js` (≤250 lines).',
      '356.10 — Create `substeps/index.js` registry (≤80 lines, import-only).',
      '356.11 — Extract `baselineDrainageFromState.js` helper (≤60 lines).',
      '356.12 — Delete monolithic `hydrologySubstepModules.js`; shim re-export only if required.',
      '356.13 — Update imports repo-wide; `rg hydrologySubstepModules` hits zero except changelog.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js',
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepModules.test.js',
      'npm run test:world-builder',
    ],
    greps: ['wc -l world-builder/core/hydrology/substeps/*.js'],
    acceptance: [
      'Nine substep implementations live in dedicated files; registry is import-only.',
      'All existing hydrology substep behavior tests pass unchanged in outcome (update imports only as needed).',
      '`hydrologySubsteps.test.js` and `hydrologySubstepModules.test.js` remain green.',
      'eslint clean on all new/changed hydrology files.',
    ],
  },
  357: {
    blockedBy: [355, 356],
    blocks: [371, 374, 376],
    sliceType: 'regression-guard',
    reading: [
      'world-builder/docs/FLOW-FIELD-INVARIANTS.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: [
      'world-builder/core/derivedGeographyPipeline.test.js',
      'world-builder/core/hydrology/**/*.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**', 'src/pages/**'],
    steps: [
      '357.1 — Document in test comments the three full-solve stages: route, extract, settle.',
      '357.2 — Assert `fullFlowSolveCount === 3` for default generation in `derivedGeographyPipeline.test.js`.',
      '357.3 — Assert `solveLog` entries match documented stage/reason labels.',
      '357.4 — Seasonal hydrology enabled: assert no additional full solves vs baseline.',
      '357.5 — Mini thermo: no hidden full solve in substep delegate without log entry.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js',
      'npm run test:world-builder -- world-builder/core/hydrology/',
    ],
    acceptance: [
      'Default derived-geography generation still performs exactly **three** full flow solves (or the currently documented invariant—update tests only if behavior was wrong).',
      '`flowFieldSession.solveLog` entries retain stage/reason labels used by generation report.',
      'Enabling seasonal hydrology does not accidentally add silent full solves.',
      '`derivedGeographyPipeline.test.js` and hydrology substep tests covering flow counts pass.',
    ],
  },
  358: {
    blockedBy: [355, 356],
    blocks: [371, 374, 376],
    sliceType: 'regression-guard',
    reading: [
      'world-builder/docs/RIVER-MASK-LIFECYCLE.md',
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
    ],
    mayTouch: [
      'world-builder/core/hydrology/**/*.test.js',
      'world-builder/core/hydrology/riverMaskLifecycle.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '358.1 — Snapshot tests: stage order sketch→incised→settled→presentation→painted.',
      '358.2 — `skipRefine` transition test unchanged.',
      '358.3 — `enableMeanderRefine: true` → presentation masks change; `simulationRiverMask` byte-equal.',
      '358.4 — `riverAttractionRadiusScale` opt-in → same byte-invariance on simulation mask.',
      '358.5 — Assert `simulationRiverMask` source = settled stage via public API only.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/hydrology/riverMaskLifecycle.test.js',
      'npm run test:world-builder -- world-builder/core/hydrology/',
    ],
    acceptance: [
      'Mask lifecycle snapshots in hydrology tests still match stage order with defaults off (skipRefine transition).',
      '`simulationRiverMask` on pipeline/world document still comes from settled simulation centerline, not presentation refine.',
      'Opt-in `enableMeanderRefine` changes presentation masks only; `simulationRiverMask` byte-identical vs default.',
      'Opt-in `riverAttractionRadiusScale` changes presentation only; `simulationRiverMask` byte-identical vs default.',
      '`riverMaskLifecycle.test.js` and hydrology seam contract tests pass.',
    ],
  },
  359: {
    blockedBy: [],
    blocks: [360, 361, 376],
    sliceType: 'landmass-module',
    reading: [
      'world-builder/docs/LANDMASS-STAGE-MODULES.md',
      'world-builder/docs/ARCHITECTURE-SEAMS.md',
    ],
    mayTouch: [
      'world-builder/core/stages/**',
      'world-builder/core/landmassPipelineStageModules.js',
      'world-builder/core/derivedGeographyPipeline.js',
      'world-builder/core/runLandmassPipeline.test.js',
      'world-builder/core/derivedGeographyPipeline.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**', 'src/pages/**'],
    steps: [
      '359.1 — Create `stages/physicalTerrainBaselineStage.js` from baseline step body.',
      '359.2 — Create `stages/erosionStage.js`.',
      '359.3 — Create `stages/hydrologyStage.js` (delegate to hydrology runner).',
      '359.4 — Create `stages/fieldRefreshStage.js`.',
      '359.5 — Create `stages/coastAndResourcesStage.js`.',
      '359.6 — Create `stages/validationStage.js`.',
      '359.7 — Create `landmassPipelineStageModules.js` ordered registry.',
      '359.8 — Replace `executeLandmassPipelineStage` switch with module loop.',
      '359.9 — `runLandmassPipeline.test.js` + `derivedGeographyPipeline.test.js` green.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js',
      'npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js',
    ],
    acceptance: [
      'Each landmass pipeline stage has a module object colocated with or adjacent to its implementation.',
      'Stage modules export `id`, `label`, `inputs`, `outputKeys`, and `run` (or documented equivalent).',
      '`runPipelineStep` dispatches through stage modules instead of a large switch with ad-hoc pickers.',
      'No behavior change for default generation and validation exhausted path.',
      '`runLandmassPipeline.test.js` and `derivedGeographyPipeline.test.js` pass.',
    ],
  },
  360: {
    blockedBy: [359],
    blocks: [361, 371, 376],
    sliceType: 'landmass-contract-derive',
    reading: [
      'world-builder/docs/LANDMASS-STAGE-MODULES.md',
      'world-builder/docs/HYDROLOGY-TYPED-STAGES.md',
    ],
    mayTouch: [
      'world-builder/core/landmassPipelineStageContracts.js',
      'world-builder/core/landmassPipelineStageContracts.test.js',
      'world-builder/core/stages/**',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '360.1 — Implement `deriveLandmassStageContract(module)` mirroring hydrology pattern.',
      '360.2 — Replace manual `LANDMASS_PIPELINE_STAGE_CONTRACTS` object.',
      '360.3 — Replace `pickLandmassStageInput` switch with `selectLandmassStageInput(module, state)`.',
      '360.4 — Delete redundant JSDoc typedefs duplicating module inputs.',
      '360.5 — Update `landmassPipelineStageContracts.test.js` — test derivation, not parallel tables.',
      '360.6 — grep: no hand-maintained `inputKeys:` arrays outside derive function.',
      '360.7 — Mini arch: deletion test on old pickers.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js',
    ],
    greps: ["rg 'inputKeys:' world-builder/core/ --glob '*.js' | rg -v derive"],
    acceptance: [
      '`LANDMASS_PIPELINE_STAGE_CONTRACTS` is computed from stage modules, not duplicated by hand.',
      '`pickLandmassStageInput` (or successor) uses module input selectors.',
      '`assertLandmassStageOutputs` validates against module `outputKeys`.',
      '`landmassPipelineStageContracts.test.js` updated to test derivation, not parallel tables.',
      'No duplicate contract definition surfaces remain for landmass stages.',
    ],
  },
  361: {
    blockedBy: [359, 360],
    blocks: [370, 372, 374, 376, 383, 384],
    sliceType: 'orchestrator-decompose',
    reading: [
      'world-builder/docs/ORCHESTRATOR-DECOMPOSITION.md',
      'world-builder/docs/FILE-SIZE-BUDGET.md',
    ],
    mayTouch: [
      'world-builder/core/derivedGeographyPipeline.js',
      'world-builder/core/cloneWorldDocument.js',
      'world-builder/core/buildWorldDocumentFromPipelineState.js',
      'world-builder/core/landmassPipelineRunner.js',
      'world-builder/worker/**',
      'world-builder/worldBuilder.integration.test.js',
      'world-builder/core/derivedGeographyPipeline.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '361.1 — Extract clone helper to `cloneWorldDocument.js` (≤80 lines).',
      '361.2 — Extract world doc assembly to `buildWorldDocumentFromPipelineState.js` (≤70 lines).',
      '361.3 — Extract retry + hooks + step loop to `landmassPipelineRunner.js` (≤300 lines).',
      '361.4 — Slim `derivedGeographyPipeline.js` to re-exports + thin dispatch (≤650 lines).',
      '361.5 — Update worker + integration imports.',
      '361.6 — wc -l gate on all production files touched.',
      '361.7 — Full test suite green.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js',
      'npm run test:world-builder -- world-builder/worldBuilder.integration.test.js',
      'npm run test:world-builder -- world-builder/worker/',
    ],
    greps: ['wc -l world-builder/core/derivedGeographyPipeline.js'],
    acceptance: [
      '`derivedGeographyPipeline.js` (or renamed orchestrator) is under 650 lines.',
      'No production file introduced or enlarged past **1000 lines** by this decomposition.',
      '`generateDerivedGeography`, worker protocol, and page generation still work end-to-end.',
      '`derivedGeographyPipeline.test.js`, `worldBuilder.integration.test.js`, and worker tests pass.',
      'eslint clean on extracted modules.',
    ],
  },
  362: {
    blockedBy: [],
    blocks: [363, 369, 376, 385],
    sliceType: 'overlay-vector-layer',
    reading: [
      'world-builder/docs/OVERLAY-LAYER-LOCALITY.md',
      'world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md',
    ],
    mayTouch: [
      'world-builder/renderer/createWorldBuilderMapViewport.js',
      'world-builder/renderer/mapLayerRefresh.js',
      'world-builder/renderer/worldBuilderMapViewportModel.js',
      'world-builder/resourceOverlays.js',
      'world-builder/renderer/resourceRasterOverlayRefresh.js',
      'world-builder/renderer/**/*.test.js',
    ],
    mustNotTouch: ['world-builder/core/hydrology/**', 'world-builder/core/derivedGeographyPipeline.js'],
    steps: [
      '362.1 — Extend `MapLayerId` type: `coastalNodes`, `metalNodes`, `saltNodes`.',
      '362.2 — Add `vectorLayerId` to resource overlay definitions.',
      '362.3 — Rewrite `diffResourceOverlayMapLayers` — no monolithic `vectorOverlays`.',
      '362.4 — Rewrite `diffWorldDocumentMapLayers` — coastal → `coastalNodes` only.',
      '362.5 — Split viewport draw: independent groups per vector layer family.',
      '362.6 — Register handlers in `mapLayerRefresh.js` per vector layer.',
      '362.7 — Migration: remove `vectorOverlays` from production paths (grep gate).',
      '362.8 — Raster regression: existing overlay sync tests still pass.',
      '362.9 — Mini thermo: toggling salt must not call coastal draw handler.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js',
      'npm run test:world-builder -- world-builder/renderer/',
    ],
    greps: [
      "rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\\.test\\.'",
    ],
    acceptance: [
      'Toggling salt node visibility refreshes only salt vector layer (+ any shared infrastructure explicitly documented), not coastal or metal markers.',
      'Toggling metals visibility refreshes only metal vector layer when nodes are visible.',
      'Raster overlay locality from Phase 4 remains unchanged (regression tests pass).',
      'Deprecated per-overlay viewport mutators remain absent.',
      'eslint clean on changed renderer files.',
    ],
  },
  363: {
    blockedBy: [362],
    blocks: [369, 376, 385],
    sliceType: 'overlay-vector-test',
    reading: [
      'world-builder/docs/OVERLAY-LAYER-LOCALITY.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: [
      'world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js',
      'world-builder/renderer/createWorldBuilderMapViewport.*.test.js',
    ],
    mustNotTouch: ['world-builder/core/**'],
    steps: [
      '363.1 — Test: arable+timber+metals+salt rasters on; toggle salt nodes only → raster RGBA build 0.',
      '363.2 — Test: coastal present; toggle salt only → coastal draw count unchanged.',
      '363.3 — Test: toggle metals nodes only → salt and coastal unchanged.',
      '363.4 — Extend harness: per-layer spy (`drawnCirclesByLayer` or equivalent).',
      '363.5 — No source-grep or import-ban assertions.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js',
    ],
    acceptance: [
      'Test: enable arable+timber+metals+salt rasters, then toggle salt nodes only—resource raster RGBA build count stays 0.',
      'Test: coastal nodes present; toggle salt only—coastal draw count unchanged (or coastal layer not refreshed).',
      'Test: toggle metals nodes only—salt and coastal unchanged.',
      'Tests run under `npm run test:world-builder` (with module mocks), not skipped.',
      'No source-grep or import-ban assertions.',
    ],
  },
  364: {
    blockedBy: [],
    blocks: [365, 366, 376],
    sliceType: 'simulation-seam-test',
    reading: [
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: ['world-builder/core/hydrology/**/*Seam*.test.js', 'world-builder/**/*SeamContract*.test.js'],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '364.1 — Fix `hydrologyRiverPathfindingSeamContract.test.js` default generation test.',
      '364.2 — Assert `simulationRiverMask` length and cell count > 0.',
      '364.3 — Rename tests whose titles say simulation but check presentation only.',
      '364.4 — Audit all `*SeamContract*.test.js`; update SEAM-TEST-CATALOG matrix.',
      '364.5 — Mini thermo: zero mismatched simulation titles.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js',
      'npm run test:world-builder -- world-builder/**/*SeamContract*.test.js',
    ],
    acceptance: [
      '`hydrologyRiverPathfindingSeamContract.test.js` default-generation test asserts populated `simulationRiverMask` with correct length and cell count.',
      'Test documents relationship: under Option A defaults, simulation and presentation centerlines may match, but logistics consumers must use `simulationRiverMask`.',
      'No test title claims simulation while only asserting presentation masks unless the test\'s purpose is explicitly cross-field comparison.',
      '`npm run test:world-builder` passes.',
    ],
  },
  365: {
    blockedBy: [364],
    blocks: [370, 373, 376, 386],
    sliceType: 'simulation-consumer',
    reading: [
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
      'world-builder/docs/ARCHITECTURE-SEAMS.md',
    ],
    mayTouch: [
      'world-builder/core/validation/runGeographyValidationChecks.js',
      'world-builder/core/validation/runGeographyValidationChecks.test.js',
      'world-builder/core/buildGenerationReport.js',
      'world-builder/core/buildGenerationReport.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '365.1 — Trace validation river/navigability inputs; document in issue comment.',
      '365.2 — Switch to `simulationRiverMask` for `assembleRiverNetwork` where logistics metrics.',
      '365.3 — Generation report hydrology section uses simulation graph.',
      '365.4 — Test: meander on → validation metrics unchanged.',
      '365.5 — `runGeographyValidationChecks.test.js` green.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/validation/runGeographyValidationChecks.test.js',
      'npm run test:world-builder -- world-builder/core/buildGenerationReport.test.js',
    ],
    acceptance: [
      'Validation slice assembly passes simulation centerline into `assembleRiverNetwork` (or equivalent) when computing navigability metrics.',
      'Generation report hydrology metrics (mouth count, navigable km, Hacks law, etc.) derive from simulation graph/mask.',
      'Presentation-only option toggles do not change validation outcomes for checks that are physics-facing.',
      'Tests prove validation metrics invariant when only presentation meander/attraction is enabled.',
      '`runGeographyValidationChecks.test.js` and pipeline validation tests pass.',
    ],
  },
  366: {
    blockedBy: [364],
    blocks: [373, 376],
    sliceType: 'worker-clone',
    reading: [
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
      'world-builder/docs/ARCHITECTURE-SEAMS.md',
    ],
    mayTouch: [
      'world-builder/core/cloneWorldDocument.js',
      'world-builder/worker/derivedGeographyWorkerProtocol.js',
      'world-builder/worker/derivedGeographyWorkerProtocol.test.js',
      'world-builder/runDerivedGeographyInWorker.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '366.1 — Audit worker step payloads for `simulationRiverMask`.',
      '366.2 — `cloneWorldDocument` deep copy — no shared buffers with presentation masks.',
      '366.3 — Test preview doc with meander on — simulation field retained.',
      '366.4 — `runDerivedGeographyInWorker.test.js` updated.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/worker/derivedGeographyWorkerProtocol.test.js',
      'npm run test:world-builder -- world-builder/runDerivedGeographyInWorker.test.js',
    ],
    acceptance: [
      'Worker protocol tests assert `simulationRiverMask` in validation/final payloads.',
      '`cloneWorldDocument` (or successor) deep-copies simulation mask independently from presentation masks.',
      'Preview documents applied to map during generation retain simulation field when presentation fields differ (meander on).',
      'Existing clone/worker tests pass; add coverage if gaps found.',
    ],
  },
  367: {
    blockedBy: [],
    blocks: [376],
    sliceType: 'checkbox-ux',
    reading: [
      'world-builder/docs/PAGE-CONTROLLER-INTERFACE.md',
      'world-builder/docs/OVERLAY-LAYER-LOCALITY.md',
    ],
    mayTouch: [
      'src/pages/projects/WorldBuilderPage.vue',
      'world-builder/resourceOverlayState.js',
      'world-builder/resourceOverlayState.test.js',
      'src/composables/useWorldBuilderOverlayState.js',
      'world-builder/worldBuilderOverlayControls.js',
    ],
    mustNotTouch: ['world-builder/core/hydrology/**', 'world-builder/core/derivedGeographyPipeline.js'],
    steps: [
      '367.1 — Reproduce: document exact Quasar props causing indeterminate state.',
      '367.2 — Normalize booleans in overlay owner before commit.',
      '367.3 — Fix SFC bindings — no tri-state `:model-value`.',
      '367.4 — Seam test: on→off === false (no copy assertions).',
      '367.5 — Manual repro steps in issue comment (for #381).',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/resourceOverlayState.test.js',
      'npm run test:world-builder -- world-builder/worldBuilderOverlayControls.test.js',
    ],
    acceptance: [
      'Manual repro fixed: check overlay → uncheck overlay returns to unchecked (not indeterminate dash).',
      '`:model-value` binding uses boolean from overlay owner without tri-state leakage.',
      'If `null`/`undefined` can appear in visibility map, normalize in overlay owner before commit.',
      'Behavioral test at overlay composable or page-controller seam if feasible without copy assertions (state contract test).',
      'No user-facing copy assertions in tests.',
    ],
  },
  368: {
    blockedBy: [],
    blocks: [375, 376],
    sliceType: 'page-sfc',
    reading: [
      'world-builder/docs/PAGE-CONTROLLER-INTERFACE.md',
      'world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md',
    ],
    mayTouch: [
      'src/pages/projects/WorldBuilderPage.vue',
      'world-builder/worldBuilderPageModel.js',
      'world-builder/worldBuilderPageModel.test.js',
      'src/composables/useWorldBuilderPageController.js',
    ],
    mustNotTouch: ['world-builder/core/hydrology/**', 'world-builder/renderer/createWorldBuilderMapViewport.js'],
    steps: [
      '368.1 — Inventory SFC script imports from core/renderer/worker.',
      '368.2 — Move format helpers to `worldBuilderPageModel.js`.',
      '368.3 — Move validation display wiring to model or controller.',
      '368.4 — SFC imports only: vue, quasar, controller composable, page model exports.',
      '368.5 — grep gate: no `@world-builder/core` in SFC.',
      '368.6 — Mini arch: page seam matches ADR-0009.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/worldBuilderPageModel.test.js',
      'npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js',
    ],
    greps: ["rg '@world-builder/core' src/pages/projects/WorldBuilderPage.vue"],
    acceptance: [
      'SFC `<script setup>` contains no map lifecycle handles, worker imports, or generation orchestration.',
      'All `format*` display helpers consumed via page model or controller exports.',
      'Page line count reduced or unchanged with strictly less imports from core/renderer packages.',
      '`useWorldBuilderPageController.test.js` still passes; add tests if new controller exports appear.',
      'eslint clean on page + controller + model.',
    ],
  },
  369: {
    blockedBy: [362, 363],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/SEAM-TEST-CATALOG.md', 'world-builder/docs/MERGE-GATES.md'],
    mayTouch: [
      'world-builder/renderer/createWorldBuilderMapViewport.*.test.js',
      'package.json',
      'AGENTS.md',
    ],
    mustNotTouch: ['world-builder/core/**'],
    steps: [
      '369.1 — Run `npm test 2>&1 | rg -c SKIP` for viewport suites.',
      '369.2 — If skip: fix harness or document Node version in AGENTS.md.',
      '369.3 — Confirm `--experimental-test-module-mocks` in npm test script.',
      '369.4 — CI parity: full `npm test` twice — 0 skipped both runs.',
    ],
    tests: ['npm test', 'npm run test:world-builder'],
    acceptance: [
      '`npm test` reports **0 skipped** viewport overlay sync/locality/framing tests (907+ total world-builder tests, 0 skipped in full `npm test`).',
      'If Node version constraint is required, record in README or AGENTS.md (not a new markdown file unless repo already has pattern).',
      'Overlay sync locality tests from Phase 4 execute in CI, not silently skipped.',
      'No vitest introduced; keep Node native test runner.',
    ],
  },
  370: {
    blockedBy: [361, 363, 365],
    blocks: [376],
    sliceType: 'audit-adr',
    reading: [
      'world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md',
      'world-builder/docs/ARCHITECTURE-SEAMS.md',
    ],
    mayTouch: [
      'world-builder/**/*SeamContract*.test.js',
      'world-builder/renderer/rendererSeamContract.test.js',
      'world-builder/worldBuilderGenerationSeamContract.test.js',
      'world-builder/resourceOverlayStateSeamContract.test.js',
    ],
    mustNotTouch: ['world-builder/core/hydrology/substeps/**'],
    steps: [
      '370.1 — rg generation path for renderer imports — must be 0.',
      '370.2 — Complete `rendererSeamContract.test.js` behavioral coverage.',
      '370.3 — Complete `worldBuilderGenerationSeamContract.test.js`.',
      '370.4 — Complete `resourceOverlayStateSeamContract.test.js`.',
      '370.5 — Findings list → PR test plan section (not new ad-hoc docs).',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/renderer/rendererSeamContract.test.js',
      'npm run test:world-builder -- world-builder/worldBuilderGenerationSeamContract.test.js',
      'npm run test:world-builder -- world-builder/resourceOverlayStateSeamContract.test.js',
    ],
    greps: ["rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test"],
    acceptance: [
      '`useWorldBuilderGeneration`, orchestrator, and worker modules have no imports from renderer package.',
      '`rendererSeamContract.test.js` covers displayBiomes terrain, presentation river overlay, and biome/presentation separation behaviorally.',
      '`worldBuilderGenerationSeamContract.test.js` proves generation completes without viewport.',
      '`resourceOverlayStateSeamContract.test.js` proves owner-only viewport mutation path.',
      'No `readFileSync` source greps in world-builder runtime seam tests (research asset tests exempt).',
      'Audit findings documented in PR test plan (not new repo docs unless glossary update needed).',
    ],
  },
  371: {
    blockedBy: [357, 358, 360, 361],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/SEAM-TEST-CATALOG.md', 'world-builder/docs/MINI-REVIEW-RUBRICS.md'],
    mayTouch: [
      'world-builder/core/hydrology/hydrologySubstepContracts.test.js',
      'world-builder/core/landmassPipelineStageContracts.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '371.1 — List tests that only assert key list parity.',
      '371.2 — Delete redundant; keep one derive test per pipeline.',
      '371.3 — Test count may decrease; behavior coverage same or better.',
      '371.4 — Run full hydrology + landmass contract integration tests.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js',
      'npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js',
      'npm run test:world-builder',
    ],
    acceptance: [
      'No test file exists solely to assert contract key lists mirror module metadata (one derivation test per pipeline is enough).',
      '`hydrologySubstepContracts.test.js` and `landmassPipelineStageContracts.test.js` focus on integration invariants, not parallel tables.',
      'Test count may decrease; behavior coverage must not.',
      '`npm run test:world-builder` passes.',
    ],
  },
  372: {
    blockedBy: [356, 361],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/FILE-SIZE-BUDGET.md', 'world-builder/docs/MERGE-GATES.md'],
    mayTouch: [],
    mustNotTouch: ['All production code — audit only unless split required'],
    steps: [
      '372.1 — List all production `.js`/`.vue` on branch — flag >600, >800, >1000 lines.',
      '372.2 — Any >1000: split or justify in PR body.',
      '372.3 — Confirm orchestrator ≤650, hydrology registry ≤80, substep files ≤250.',
      '372.4 — Summarize audit in merge PR body template.',
    ],
    tests: ['npm run test:world-builder'],
    greps: [
      "find world-builder -name '*.js' -not -path '*/test*' -not -name '*.test.js' -exec wc -l {} + | sort -n | tail -20",
    ],
    acceptance: [
      'No production `.js`/`.vue` file on the branch exceeds 1000 lines without explicit PR justification.',
      '`hydrologySubstepModules` monolith eliminated (see #356).',
      '`derivedGeographyPipeline` orchestrator under 650 lines (see #361).',
      '`worldBuilderGenerationControls` metadata either accepted under limit or split by control section if over threshold.',
      'Audit result summarized in merge PR body.',
    ],
  },
  373: {
    blockedBy: [365, 366],
    blocks: [376],
    sliceType: 'docs-only',
    reading: [
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
      'world-builder/CONTEXT.md',
    ],
    mayTouch: ['world-builder/CONTEXT.md'],
    mustNotTouch: ['world-builder/core/**', 'world-builder/renderer/**'],
    steps: [
      '373.1 — Add `Simulation hydrology` and `Presentation hydrology` to Language section.',
      '373.2 — Document `_Avoid` aliases.',
      '373.3 — Cross-check terms match SIMULATION-VS-PRESENTATION-HYDROLOGY.md.',
      '373.4 — No implementation detail in CONTEXT.md.',
    ],
    tests: [],
    acceptance: [
      'CONTEXT.md defines simulation hydrology outputs (logistics-facing) and presentation hydrology outputs (map display).',
      '`_Avoid` aliases documented (e.g. using "river network mask" alone when meaning simulation).',
      'Terms match issue/PRD vocabulary used in #354 tree.',
      'No code changes required beyond glossary unless naming mismatch found.',
    ],
  },
  374: {
    blockedBy: [357, 358, 361],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/SEAM-TEST-CATALOG.md', 'world-builder/docs/MERGE-GATES.md'],
    mayTouch: [
      'world-builder/worldBuilder.integration.test.js',
      'world-builder/core/generateDerivedGeography.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '374.1 — One integration test — modest grid (64² or 128²).',
      '374.2 — Assert world document, simulationRiverMask, displayBiomes, validation report.',
      '374.3 — Runtime <60s CI.',
      '374.4 — No hydrology internal mocks.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/worldBuilder.integration.test.js',
      'npm run test:world-builder -- world-builder/core/generateDerivedGeography.test.js',
    ],
    acceptance: [
      'Single smoke test covers full default pipeline without mocking hydrology internals.',
      'Asserts `simulationRiverMask` populated post-hydrology.',
      'Asserts `displayBiomes` populated.',
      'Runs in `npm run test:world-builder` under 60s on CI hardware (use modest grid if needed).',
      'Fails if pipeline wiring regresses across module refactor.',
    ],
  },
  375: {
    blockedBy: [368],
    blocks: [376, 384],
    sliceType: 'page-controller-test',
    reading: [
      'world-builder/docs/PAGE-CONTROLLER-INTERFACE.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: ['src/composables/useWorldBuilderPageController.test.js', 'src/composables/useWorldBuilderPageController.js'],
    mustNotTouch: ['world-builder/core/hydrology/**', 'world-builder/renderer/**'],
    steps: [
      '375.1 — Test `onToggleChange` regenerates.',
      '375.2 — Test `onSliderInput` does not regenerate until commit.',
      '375.3 — Test `randomizeSeed` updates seed + regen.',
      '375.4 — Test `resetOverlays` visibility reset + sync.',
      '375.5 — Test error forwarding via `onGenerationError`.',
      '375.6 — Test `start()` overlay sync on viewport ready.',
      '375.7 — Matrix: every public controller method with side effects has a test.',
    ],
    tests: ['npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js'],
    acceptance: [
      'Each public controller method with side effects has at least one behavioral test.',
      'Tests use injected fakes (no full Vue page mount, no copy assertions).',
      'Overlay sync to viewport verified on `start()` viewport ready.',
      'All tests pass; eslint clean.',
    ],
  },
  376: {
    blockedBy: [
      355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 383, 384, 385, 386,
    ],
    blocks: [377, 378],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/COMMIT-SLICE-MAP.md', 'world-builder/docs/MERGE-GATES.md'],
    mayTouch: [],
    mustNotTouch: ['No code changes — git hygiene only (maintainer commits)'],
    steps: [
      '376.1 — Group commits per COMMIT-SLICE-MAP (hydrology, landmass, overlay, tests, glossary).',
      '376.2 — Maintainer performs commits (agent hooks block autonomous commit).',
      '376.3 — Push branch to origin.',
      '376.4 — Verify `git status` clean; no orphaned deleted test files.',
    ],
    tests: ['git status', 'git log --oneline -20'],
    acceptance: [
      '`git status` clean after Phase 5 implementation.',
      'Commits grouped by slice (not one giant commit, not 50 one-line commits).',
      'Commit messages reference issue numbers where helpful.',
      'Branch pushed to origin before PR.',
    ],
  },
  377: {
    blockedBy: [376],
    blocks: [379, 380],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/MERGE-GATES.md', 'world-builder/docs/REWORK-PROTOCOL.md'],
    mayTouch: ['Any Phase 5 touched files with lint fixes only'],
    mustNotTouch: ['Unrelated repo areas unless pre-existing lint failures documented'],
    steps: [
      '377.1 — Run `npm run lint` on full repo.',
      '377.2 — Run `npx eslint --max-warnings 0` on every Phase 5 touched file.',
      '377.3 — Fix all errors/warnings; no new eslint-disable without justification.',
      '377.4 — Document pre-existing failures outside world-builder if any remain.',
    ],
    tests: ['npm run lint'],
    acceptance: [
      '`npm run lint` exits 0 with `--max-warnings 0` equivalent (repo default).',
      'Every file created or modified in Phase 5 individually passes `npx eslint --max-warnings 0 <file>`.',
      'No `eslint-disable` added unless pre-existing pattern with justification.',
    ],
  },
  378: {
    blockedBy: [376],
    blocks: [379, 380],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/MERGE-GATES.md', 'world-builder/docs/SEAM-TEST-CATALOG.md'],
    mayTouch: ['Test fixes only if failures found'],
    mustNotTouch: ['Production refactors during gate'],
    steps: [
      '378.1 — Run full `npm test`.',
      '378.2 — Run `npm run test:world-builder` twice.',
      '378.3 — Confirm 0 skipped viewport behavioral suites.',
      '378.4 — Fix any failures; no flaky tests introduced.',
    ],
    tests: ['npm test', 'npm run test:world-builder', 'npm test', 'npm run test:world-builder'],
    acceptance: [
      '`npm test` exits 0.',
      '`npm run test:world-builder` exits 0.',
      'Skipped test count is 0 for viewport behavioral suites under full `npm test`.',
      'No flaky tests introduced (run world-builder suite twice locally if needed).',
    ],
  },
  379: {
    blockedBy: [377, 378],
    blocks: [381],
    sliceType: 'audit-adr',
    reading: ['world-builder/docs/MERGE-GATES.md', 'world-builder/docs/MINI-REVIEW-RUBRICS.md'],
    mayTouch: [],
    mustNotTouch: ['Code changes unless dry-run findings require fixes'],
    steps: [
      '379.1 — Run thermo-nuclear dry-run on full branch diff vs main.',
      '379.2 — Document zero structural blockers.',
      '379.3 — Fix or defer any findings (none expected).',
      '379.4 — Capture verdict in merge PR description.',
    ],
    tests: ['npm run lint', 'npm test'],
    acceptance: [
      'Dry-run verdict is APPROVE-equivalent on structure (or COMMENT on own PR with no blockers listed).',
      'No open findings in categories: god-bag/shallow modules, overlay locality regression, source-grep tests, file >1k lines, dual contract ceremony, page orchestration leak.',
      'Findings list captured in merge PR description as "addressed" or genuinely deferred with ADR/issue (none expected).',
    ],
  },
  380: {
    blockedBy: [377, 378],
    blocks: [381],
    sliceType: 'audit-adr',
    reading: ['world-builder/docs/ARCHITECTURE-SEAMS.md', 'world-builder/docs/MINI-REVIEW-RUBRICS.md'],
    mayTouch: [],
    mustNotTouch: ['Code changes unless dry-run findings require fixes'],
    steps: [
      '380.1 — Run PR-scoped architecture dry-run (max 3 deepening items).',
      '380.2 — Verify three Strong deepenings: hydrology modules, vector locality, derived contracts.',
      '380.3 — Document deletion-test narrative in PR body.',
      '380.4 — Resolve or accept any Strong findings with written rationale.',
    ],
    tests: ['npm run test:world-builder'],
    acceptance: [
      'Hydrology modules pass deletion test (complexity concentrates in modules, not bags).',
      'Landmass contracts derived from modules.',
      'Overlay owner → viewport seam has raster **and** vector locality.',
      'Simulation vs presentation hydrology seam clear for logistics pass.',
      'No merge-blocking architecture findings remain.',
    ],
  },
  381: {
    blockedBy: [379, 380],
    blocks: [382],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/MERGE-GATES.md', 'world-builder/docs/PHASE-5-MASTER-PLAN.md'],
    mayTouch: [],
    mustNotTouch: ['Production code — manual QA only'],
    steps: [
      '381.1 — Generate default world; map renders; pan/zoom; framing on regen.',
      '381.2 — Cancel mid-generation; UI recovers; no stuck progress.',
      '381.3 — Toggle each strategic resource overlay; no indeterminate checkbox.',
      '381.4 — Change arable envelope threshold; only arable overlay affected.',
      '381.5 — Change arable threshold; reload page; verify arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).',
      '381.6 — Change geography seed; regen; validation panel updates.',
      '381.7 — Reset defaults; overlay display settings restore.',
      '381.8 — Validation row map focus zooms expected region.',
      '381.9 — Exhausted validation run shows failure indicator without breaking map.',
      '381.10 — Record results in merge PR test plan.',
    ],
    tests: ['npx quasar dev — manual at http://localhost:9000/#/projects/world-builder'],
    acceptance: [
      'Generate default world; map renders; pan/zoom works; framing preserved on regen.',
      'Cancel mid-generation; UI returns to cancellable state; no stuck progress bar.',
      'Toggle each strategic resource overlay on/off; no indeterminate checkbox; no visible stutter on 256²+ grid if available.',
      'Change arable envelope threshold; only arable overlay affected visually.',
      'Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).',
      'Change geography seed; regen; validation panel updates.',
      'Reset defaults; overlay display settings restore.',
      'Validation row map focus zooms/focuses expected region.',
      'Exhausted validation run shows failure indicator without breaking map.',
      'Results checked off in PR test plan.',
    ],
  },
  382: {
    blockedBy: [381],
    blocks: [],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/MERGE-GATES.md', 'world-builder/docs/PHASE-5-MASTER-PLAN.md'],
    mayTouch: [],
    mustNotTouch: ['No code — PR creation only'],
    steps: [
      '382.1 — Open ready-for-review PR `world-builder` → `main`.',
      '382.2 — PR body: Phase 1–5 summary, ADR-0009 compliance, issue closure list.',
      '382.3 — PR test plan includes manual QA from #381.',
      '382.4 — Confirm CI green; assignee enmaku.',
    ],
    tests: ['npm run lint', 'npm test', 'npm run build'],
    acceptance: [
      'PR created ready for review (not draft).',
      'PR body summarizes Phase 1–5 outcomes and ADR-0009 compliance.',
      'PR test plan includes manual QA checklist from #381.',
      'CI green on PR (`npm run lint`, `npm test`, build if CI runs build).',
      'Assignee: enmaku.',
      'Links closing keywords for #354 when merged (do not auto-close #293 unless intended).',
    ],
  },
  383: {
    blockedBy: [361, 362],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: [
      'world-builder/docs/OVERLAY-LAYER-LOCALITY.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: ['world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js'],
    mustNotTouch: ['world-builder/core/**'],
    steps: [
      '383.1 — Run `createWorldBuilderMapViewport.documentUpdate.test.js` (0 skipped).',
      '383.2 — Assert `displayBiomes`-only change refreshes terrain, not rivers/lakes/rasters.',
      '383.3 — Assert presentation mask change refreshes rivers/lakes appropriately.',
      '383.4 — Add build-count spies if gaps exist; no copy assertions.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js',
    ],
    acceptance: [
      '`createWorldBuilderMapViewport.documentUpdate.test.js` passes with 0 skipped.',
      'Changing only `displayBiomes` refreshes terrain, not rivers/lakes/rasters (or documented correct set).',
      'Changing river presentation masks refreshes rivers/lakes as appropriate, not full terrain stack unless required.',
      'Build-count or visibility spies prove locality where tests already exist.',
    ],
  },
  384: {
    blockedBy: [361, 375],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/SEAM-TEST-CATALOG.md', 'world-builder/docs/PAGE-CONTROLLER-INTERFACE.md'],
    mayTouch: [
      'world-builder/worldBuilderGenerationCancel.test.js',
      'world-builder/worldBuilderGenerationOrchestrator.test.js',
      'src/composables/useWorldBuilderPageController.test.js',
    ],
    mustNotTouch: ['world-builder/core/hydrology/**'],
    steps: [
      '384.1 — Run `worldBuilderGenerationCancel.test.js`.',
      '384.2 — Run orchestrator stale-run and cancel tests.',
      '384.3 — Verify page controller destroy cancels active run.',
      '384.4 — Assert no duplicate world-document apply from stale worker after rapid regenerate.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/worldBuilderGenerationCancel.test.js',
      'npm run test:world-builder -- world-builder/worldBuilderGenerationOrchestrator.test.js',
      'npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js',
    ],
    acceptance: [
      '`worldBuilderGenerationCancel.test.js` passes.',
      '`worldBuilderGenerationOrchestrator.test.js` stale-run and cancel tests pass.',
      'Page controller destroy cancels active run (controller test).',
      'No duplicate world-document apply from stale worker after rapid regenerate.',
    ],
  },
  385: {
    blockedBy: [362, 363],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: ['world-builder/docs/OVERLAY-LAYER-LOCALITY.md', 'world-builder/docs/PAGE-CONTROLLER-INTERFACE.md'],
    mayTouch: [
      'world-builder/resourceOverlayState.test.js',
      'world-builder/resourceOverlayStateSeamContract.test.js',
      'src/composables/useWorldBuilderOverlayState.js',
    ],
    mustNotTouch: ['world-builder/core/**'],
    steps: [
      '385.1 — Run overlay state + seam contract tests.',
      '385.2 — Verify `resetDefaults` restores persisted defaults and syncs viewport once.',
      '385.3 — Verify `setResourceOverlayDisplaySetting` persists with locality.',
      '385.4 — Document manual reload spot-check for #381.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/resourceOverlayState.test.js',
      'npm run test:world-builder -- world-builder/resourceOverlayStateSeamContract.test.js',
    ],
    acceptance: [
      '`useWorldBuilderOverlayState.test.js` and seam contract tests pass.',
      '`resetDefaults` restores persisted defaults and syncs viewport once.',
      '`setResourceOverlayDisplaySetting` persists to settings store and commits with locality.',
      'Manual spot-check: reload page retains arable threshold.',
    ],
  },
  386: {
    blockedBy: [365],
    blocks: [376],
    sliceType: 'regression-guard',
    reading: [
      'world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md',
      'world-builder/docs/SEAM-TEST-CATALOG.md',
    ],
    mayTouch: [
      'world-builder/core/validation/runGeographyValidationChecks.test.js',
      'world-builder/core/landmassValidationContracts.test.js',
      'world-builder/core/runLandmassPipeline.test.js',
    ],
    mustNotTouch: ['world-builder/renderer/**'],
    steps: [
      '386.1 — Run validation + landmass contract tests.',
      '386.2 — Verify exhausted retry behavior unchanged on known fixtures.',
      '386.3 — Assert validation rows still expose `mapFocus` for controller focus tests.',
      '386.4 — Confirm simulation mask does not break coast mouth or navigable checks.',
    ],
    tests: [
      'npm run test:world-builder -- world-builder/core/validation/runGeographyValidationChecks.test.js',
      'npm run test:world-builder -- world-builder/core/landmassValidationContracts.test.js',
      'npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js',
    ],
    acceptance: [
      '`runGeographyValidationChecks.test.js` and `landmassValidationContracts.test.js` pass.',
      '`runLandmassPipeline.test.js` exhausted retry behavior unchanged.',
      'Validation rows still expose `mapFocus` where expected for page controller focus tests.',
      'Simulation mask used does not break coast mouth or navigable path checks on known fixtures.',
    ],
  },
}

function issueLink(n) {
  return `${REPO}/issues/${n}`
}

function formatList(items, prefix = '- ') {
  return items.map((i) => `${prefix}${i}`).join('\n')
}

function formatNumbered(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n')
}

function formatBlockedBy(nums) {
  if (nums.length === 0) return 'None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).'
  return nums.map((n) => `- [#${n}](${issueLink(n)})`).join('\n')
}

function formatBlocks(nums) {
  if (nums.length === 0) return 'None — terminal slice or merge PR gate.'
  return nums.map((n) => `- [#${n}](${issueLink(n)})`).join('\n')
}

function buildPlan(n, meta, title) {
  const reading = [...COMMON_READING, ...meta.reading, `world-builder/docs/plans/ISSUE-${n}.md`]
  const uniqueReading = [...new Set(reading)]

  const autoVerify = [
    '```bash',
    '# From repo root on world-builder branch',
    'git diff --name-only',
    '',
    '# ESLint — every changed .js / .vue',
    'npx eslint --max-warnings 0 <changed-files>',
    '',
    ...meta.tests.map((t) => t),
    '',
    '# Line counts — production files touched',
    'wc -l <changed-production-files>',
    ...(meta.greps || []).map((g) => `\n${g}`),
    '```',
  ].join('\n')

  return `# Issue #${n} — ${title}

> **GitHub:** [#${n}](${issueLink(n)})  
> **Parent epic:** [#354](${issueLink(354)}) — Phase 5 final merge-readiness pass  
> **Branch:** \`world-builder\` (no new branch)

---

## Summary

This sub-plan implements [#${n}](${issueLink(n)}) under epic [#354](${issueLink(354)}). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

${formatBlockedBy(meta.blockedBy)}

### Blocks

${formatBlocks(meta.blocks)}

---

## Slice type

**MINI-REVIEW-RUBRICS.md § \`${meta.sliceType}\`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any \`[blocker]\`, \`[structure]\`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

${formatNumbered(uniqueReading)}

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

${formatNumbered(meta.steps)}

---

## Files MAY touch

${formatList(meta.mayTouch.length ? meta.mayTouch : ['*(none — audit / gate / docs-only slice)*'])}

---

## Files MUST NOT touch

${formatList(meta.mustNotTouch)}

Additional global forbiddens (all slices):

- \`world-builder/core/**\` importing from \`world-builder/renderer/**\`
- Drive-by refactors outside this issue scope
- New product scope (settlement, culture engine, logistics pass, history log)
- Closing GitHub issues from subagent self-report

---

## AutoVerify

Run all commands; paste output to parent orchestrator.

${autoVerify}

---

## Acceptance criteria

Copied from GitHub issue body ([#${n}](${issueLink(n)})):

${meta.acceptance.map((ac) => `- [ ] ${ac}`).join('\n')}

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#${n}.1 … #${n}.${meta.steps.length}) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] \`npx eslint --max-warnings 0\` on every changed file
- [ ] Targeted \`npm run test:world-builder\` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#${n}](${issueLink(n)})

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](${issueLink(354)}) |
| Grandparent | [#293](${issueLink(293)}) |
| Blocked by | ${meta.blockedBy.length ? meta.blockedBy.map((x) => `#${x}`).join(', ') : '—'} |
| Blocks | ${meta.blocks.length ? meta.blocks.map((x) => `#${x}`).join(', ') : '—'} |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
`
}

function buildPrompt(n, meta, title) {
  const reading = [...COMMON_READING, ...meta.reading, `world-builder/docs/plans/ISSUE-${n}.md`]
  const uniqueReading = [...new Set(reading)]

  const autoVerify = [
    '```bash',
    'git diff --name-only',
    'npx eslint --max-warnings 0 <changed-files>',
    ...meta.tests,
    'wc -l <changed-production-files>',
    ...(meta.greps || []),
    '```',
  ].join('\n')

  return `# Subagent prompt — Issue #${n}

> Copy-paste this entire file to launch an **implementer** subagent for [#${n}](${issueLink(n)}).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 \`DOC-AUDIT\` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#${n}](${issueLink(n)}) blockers are not closed:

${meta.blockedBy.length ? meta.blockedBy.map((b) => `- [#${b}](${issueLink(b)}) must be Parent QA PASS`).join('\n') : '- No blockers — you may start immediately.'}

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the \`world-builder\` branch. You deliver only what this prompt and [plans/ISSUE-${n}.md](../plans/ISSUE-${n}.md) specify.

---

## Issue

- **Title:** ${title}
- **Link:** [#${n}](${issueLink(n)})
- **Parent:** [#354](${issueLink(354)})
- **Slice type:** \`${meta.sliceType}\` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

${formatNumbered(uniqueReading)}

---

## Scope boundary

### Files you MAY touch

${formatList(meta.mayTouch.length ? meta.mayTouch : ['*(none — audit / gate / docs-only)*'])}

### Files you MUST NOT touch

${formatList(meta.mustNotTouch)}

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-${n}.md](../plans/ISSUE-${n}.md):

${formatNumbered(meta.steps)}

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

${autoVerify}

Self-check against **MINI-REVIEW-RUBRICS.md § \`${meta.sliceType}\`** before handoff.

---

## Acceptance criteria (verbatim)

${meta.acceptance.map((ac) => `- [ ] ${ac}`).join('\n')}

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § \`${meta.sliceType}\` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #${n}. MINI-REVIEW-RUBRICS.md § \`${meta.sliceType}\`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-${n}.md](../plans/ISSUE-${n}.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
`
}

const titles = {
  355: 'Hydrology typed stage outputs (eliminate god-bag world)',
  356: 'Split hydrology substep modules into per-substep files',
  357: 'Hydrology flow-field recompute invariants after typing refactor',
  358: 'RiverMaskPipeline lifecycle invariants after hydrology refactor',
  359: 'Landmass pipeline stage modules (derived geography steps)',
  360: 'Derive landmass stage contracts from stage modules',
  361: 'Decompose derived geography pipeline orchestrator',
  362: 'Vector overlay per-family map layer refresh',
  363: 'Vector overlay refresh locality behavioral tests',
  364: 'Fix simulation hydrology seam contract test assertions',
  365: 'Validation and generation report consume simulation river interface',
  366: 'Worker and clone round-trip for simulationRiverMask',
  367: 'Resource overlay checkbox toggle and indeterminate state',
  368: 'World Builder page display model extraction from SFC',
  369: 'Viewport behavioral tests guaranteed under npm test CI',
  370: 'ADR-0009 renderer and generation seam behavioral audit',
  371: 'Collapse redundant hydrology and landmass contract test duplication',
  372: 'Production file size audit (no file over 1000 lines)',
  373: 'CONTEXT.md simulation vs presentation hydrology vocabulary',
  374: 'Default generation end-to-end smoke after Phase 5 refactors',
  375: 'Page controller behavioral coverage completeness',
  376: 'Phase 5 branch commit hygiene on world-builder',
  377: 'Full repo eslint gate (npm run lint)',
  378: 'Full repo test gate (npm test)',
  379: 'Thermo-nuclear dry-run PR self-review (zero structural blockers)',
  380: 'Architecture dry-run PR self-review (PR-scoped)',
  381: 'Manual QA checklist for World Builder Phase 5',
  382: 'Open merge PR: world-builder → main',
  383: 'Map document dirty refresh regression guard',
  384: 'Generation cancel and stale-run regression guard',
  385: 'Pinia overlay display settings persistence regression',
  386: 'Rejection sampling and validation checks regression guard',
}

const results = []

for (let n = 355; n <= 386; n++) {
  const meta = ISSUES[n]
  const title = titles[n]
  const planPath = join(plansDir, `ISSUE-${n}.md`)
  const promptPath = join(promptsDir, `ISSUE-${n}.md`)
  const planContent = buildPlan(n, meta, title)
  const promptContent = buildPrompt(n, meta, title)
  writeFileSync(planPath, planContent)
  writeFileSync(promptPath, promptContent)
  const planLines = planContent.split('\n').length
  const promptLines = promptContent.split('\n').length
  results.push({ plan: `world-builder/docs/plans/ISSUE-${n}.md`, planLines, prompt: `world-builder/docs/SUBAGENT-WAVE-PROMPTS/ISSUE-${n}.md`, promptLines })
}

console.log(JSON.stringify(results, null, 2))
console.log('\nTotals:', results.length, 'plan files,', results.length, 'prompt files')
