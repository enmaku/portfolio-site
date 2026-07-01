/**
 * Line budgets for World Builder production code.
 * Source of truth: world-builder/docs/FILE-SIZE-BUDGET.md
 */

/** @typedef {{ max: number, label?: string }} BudgetRule */

/** Hard ceiling — any scoped production file above this fails CI. */
export const ABSOLUTE_MAX_LINES = 1000

/** Split-before-merge threshold from FILE-SIZE-BUDGET.md audit table. */
export const SPLIT_BEFORE_MERGE_LINES = 800

/** PR-review threshold — surfaced as warnings, not CI failures. */
export const REVIEW_THRESHOLD_LINES = 600

/**
 * Per-file caps from Phase 5 extraction targets (#356, #361, #359).
 * Paths are repo-root relative with forward slashes.
 *
 * @type {Record<string, BudgetRule>}
 */
export const PHASE5_FILE_BUDGETS = {
  'world-builder/core/derivedGeographyPipeline.js': { max: 650, label: 'orchestrator' },
  'world-builder/core/landmassPipelineRunner.js': { max: 300 },
  'world-builder/core/buildWorldDocumentFromPipelineState.js': { max: 70 },
  'world-builder/core/cloneWorldDocument.js': { max: 80 },
  'world-builder/core/landmassPipelineStageModules.js': { max: 120 },
  'world-builder/core/hydrology/hydrologySubsteps.js': { max: 400 },
  'world-builder/core/hydrology/baselineDrainageFromState.js': { max: 60 },
  'world-builder/core/hydrology/hydrologySubstepModules.js': { max: 80, label: 'shim registry' },
  'world-builder/core/hydrology/substeps/index.js': { max: 80, label: 'substep registry' },
  'world-builder/core/hydrology/substeps/hydrologyFillSubstep.js': { max: 250 },
  'world-builder/core/hydrology/substeps/hydrologyRouteSubstep.js': { max: 250 },
  'world-builder/core/hydrology/substeps/hydrologySettleSubstep.js': { max: 250 },
  'world-builder/core/hydrology/substeps/hydrologyPaintSubstep.js': { max: 250 },
  'world-builder/core/hydrology/substeps/hydrologyClimateSubstep.js': { max: 200 },
  'world-builder/core/hydrology/substeps/hydrologySeasonalSubstep.js': { max: 200 },
  'world-builder/core/hydrology/substeps/hydrologyInciseSubstep.js': { max: 200 },
  'world-builder/core/hydrology/substeps/hydrologyExtractSubstep.js': { max: 200 },
  'world-builder/core/hydrology/substeps/hydrologyRefineSubstep.js': { max: 200 },
  'world-builder/core/stages/coastAndResourcesStage.js': { max: 400 },
  'world-builder/core/stages/erosionStage.js': { max: 400 },
  'world-builder/core/stages/fieldRefreshStage.js': { max: 400 },
  'world-builder/core/stages/hydrologyStage.js': { max: 400 },
  'world-builder/core/stages/physicalTerrainBaselineStage.js': { max: 400 },
  'world-builder/core/stages/validationStage.js': { max: 400 },
}

/**
 * Glob-like roots scanned for production line counts (repo-root relative).
 * @type {string[]}
 */
export const PRODUCTION_SCAN_ROOTS = [
  'world-builder',
  'src/pages/projects/WorldBuilderPage.vue',
  'src/composables/useWorldBuilderGeneration.js',
  'src/composables/useWorldBuilderOverlayState.js',
  'src/composables/useWorldBuilderPageController.js',
]
