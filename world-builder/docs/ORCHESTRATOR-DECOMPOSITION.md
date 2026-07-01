# Orchestrator decomposition — `derivedGeographyPipeline.js`

> **Purpose:** Plan extraction of three cohesive units from the monolithic orchestrator so `derivedGeographyPipeline.js` stays **≤650 lines** ([#361](https://github.com/enmaku/portfolio-site/issues/361)). Current file: **884 lines** (wc -l as of Phase 5 doc authoring).
>
> **Prerequisite:** Landmass stage modules ([#359](https://github.com/enmaku/portfolio-site/issues/359)) and derived contracts ([#360](https://github.com/enmaku/portfolio-site/issues/360)) — decomposition moves orchestration glue, not stage bodies.

---

## What stays vs what moves

| Concern | Today (line region) | Target module | Budget |
|---------|---------------------|---------------|--------|
| Public API surface | exports, typedefs | `derivedGeographyPipeline.js` | re-exports only |
| Initial state + single step | `createInitialPipelineState`, `runPipelineStep` | `derivedGeographyPipeline.js` | ~80 lines |
| Stage dispatch | `executeLandmassPipelineStage` switch | stage modules (#359) | 0 in orchestrator |
| World document assembly | `buildWorldDocumentFromPipelineState` | **`buildWorldDocumentFromPipelineState.js`** | ≤70 lines |
| Deep clone for worker/previews | `cloneWorldDocument` | **`cloneWorldDocument.js`** | ≤80 lines |
| Retry + cancel + step loop | `runLandmassPipelineStepsShared`, `runLandmassPipelineWithRetryShared`, hooks | **`landmassPipelineRunner.js`** | ≤300 lines |
| Stage implementations | `runPhysicalTerrainBaselineStep` … `runValidationStep` | `stages/*.js` (#359) | per stage |

After full #359 + #361, `derivedGeographyPipeline.js` is a **facade**: re-exports, `createInitialPipelineState`, thin `runPipelineStep`, and deprecated-alias wrappers if needed.

---

## Extraction 1 — `cloneWorldDocument.js`

**Issue step:** 361.1

### Responsibility

Deep-copy typed arrays and nested graph structures so:

- Worker `postMessage` structured clone does not share mutable buffers with main thread previews.
- Step preview documents from `onStepComplete` are independent of pipeline state mutations.

### Public API

```javascript
/**
 * @param {import('./types.js').WorldDocument} doc
 * @returns {import('./types.js').WorldDocument}
 */
export function cloneWorldDocument(doc)
```

### Fields cloned (current implementation)

| Category | Fields |
|----------|--------|
| Scalar fields | `elevation`, `temperature`, `rainfall`, `drainage`, `salinity` → new typed arrays |
| Grids | `biomes`, `displayBiomes`, lake/river masks, `channelWidth`, `flowDirection`, rasters |
| Graphs | `riverGraph` nodes/edges (shallow node clone, copy `cellPath`) |
| Records | `lakes`, `lakeMeta`, `coastalNodes`, `saltNodes`, `metalNodes` |
| Report | `generationReport` with nested validation rows and signals |

### Consumers to update

- `derivedGeographyPipeline.js` (remove body, import re-export)
- `worker/derivedGeography.worker.js` (if direct import)
- Tests: `derivedGeographyPipeline.test.js`, `runLandmassPipeline.test.js`, `derivedGeography.worker.test.js`

### Tests that must stay green

All `cloneWorldDocument copies * independently` cases in `derivedGeographyPipeline.test.js`; worker round-trip ([#366](https://github.com/enmaku/portfolio-site/issues/366)).

---

## Extraction 2 — `buildWorldDocumentFromPipelineState.js`

**Issue step:** 361.2

### Responsibility

Project `DerivedGeographyPipelineState` → `WorldDocument` for:

- Final success / exhausted retry results
- Intermediate step previews (when `shouldAttachLandmassStepPreview` is true)
- Partial pipeline inspection in tests

### Public API

```javascript
/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {WorldDocument}
 */
export function buildWorldDocumentFromPipelineState(state)
```

### Logic summary (accurate to current code)

1. Require `state.baselineDoc` — throw if missing.
2. `fields = state.fields ?? baseline.fields`.
3. `biomes = state.biomes ?? classifyBiomesFromFields(...)` using eroded elevation when present.
4. `displayBiomes = buildDisplayBiomes(biomes, fields, seaLevel)`.
5. `pipelineStage`:
   - `PIPELINE_STAGE_DERIVED_GEOGRAPHY` when `lastCompletedStep === 'validation'`
   - else `PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE`
6. Attach optional hydrology, coast, resource, and report fields with `?? undefined` omission pattern.

### Dependencies (allowed)

- `./buildDisplayBiomes.js`
- `./classifyBiomesFromFields.js`
- `./biomeCatalog.js`
- `./types.js` pipeline stage constants

### Must not import

- Renderer packages
- Worker modules
- Vue / composables

### Line budget rationale

~58 lines of logic today + imports/header ≈ ≤70 lines. Keeps orchestrator from owning document shape knowledge.

---

## Extraction 3 — `landmassPipelineRunner.js`

**Issue step:** 361.3

### Responsibility

Shared **validation-retry runner** and **step loop** for:

- `runLandmassPipelineRun` (sync hooks — throws if async hooks returned)
- `runLandmassPipeline` (cooperative cancel + yield between steps)

### Public API

```javascript
/**
 * @param {DerivedGeographyParams} params
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @param {'sync' | 'cooperative'} mode
 * @returns {LandmassPipelineRunResult | Promise<LandmassPipelineRunResult>}
 */
export function runLandmassPipelineWithRetry(params, callbacks, mode)

/** @typedef {import('./derivedGeographyPipeline.js').LandmassPipelineRunResult} LandmassPipelineRunResult */
/** @typedef {import('./derivedGeographyPipeline.js').LandmassPipelineRunCallbacks} LandmassPipelineRunCallbacks */
```

Alternatively export lower-level pieces:

- `runLandmassPipelineSteps(state, callbacks, options, hooks)`
- `finalizeLandmassPipelineRun(state, error, hooks)`

…with `derivedGeographyPipeline.js` wrapping sync/async hook factories.

### Internal helpers to colocate

| Helper | Role |
|--------|------|
| `continuePipeline` | Thenable-aware sync/async bridge |
| `createHydrologyStepOptions` | Maps landmass callbacks → hydrology substep hooks |
| `createSyncLandmassPipelineHooks` | Sync `shouldCancel` |
| `createCooperativeLandmassPipelineHooks` | Async cancel + `yield()` after each step |
| `normalizeGeographySeed` | Retry seed offset |
| `finalizeLandmassPipelineRun` | Cancel vs error result shaping |

### Step loop behavior (preserve exactly)

```
for stepIndex in 0..DERIVED_GEOGRAPHY_STEPS.length-1:
  shouldCancel? → LandmassPipelineCancelledError
  onStepStart
  runPipelineStep(state, step.id, hydrologyOptions?)
  shouldCancel? → LandmassPipelineCancelledError
  if shouldAttachLandmassStepPreview(step, options):
    worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(nextState))
  onStepComplete({ state, worldDocument? })
  afterStep() / yield
  recurse stepIndex+1
```

### Retry behavior (preserve exactly)

```
attempt = 0 .. maxValidationRetries:
  state = createInitialPipelineState({ geographySeed: baseSeed + attempt, ... })
  run all steps
  if !generationReport.shouldReject → success + cloned world doc
  else → next attempt
exhausted → return last state + doc, status exhausted if shouldReject else success
```

### Dependencies

- `./landmassPipelineStageModules.js` or `runPipelineStep` from facade
- `./buildWorldDocumentFromPipelineState.js`
- `./cloneWorldDocument.js`
- `./landmassPipelineTypes.js` (cancel error)
- `./worldGenerationOptions.js`

### Line budget

~360 lines today across runner helpers; target **≤300** after stage bodies removed (#359 reduces imports in orchestrator file, not runner).

---

## Slim orchestrator — `derivedGeographyPipeline.js` (#361.4)

### Remaining exports

```javascript
export { cloneWorldDocument } from './cloneWorldDocument.js'
export { buildWorldDocumentFromPipelineState } from './buildWorldDocumentFromPipelineState.js'
export {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'

export const DERIVED_GEOGRAPHY_STEPS = ...
export function createInitialPipelineState(params)
export function runPipelineStep(state, stepId, options)
export function shouldAttachLandmassStepPreview(stepId, options)
export function runLandmassPipelineRun(params, callbacks)
export async function runLandmassPipeline(params, callbacks)
export function runFullDerivedGeographyPipeline(params)
```

### `shouldAttachLandmassStepPreview`

Stays on facade (policy, not runner):

- `true` when `options.enableIntermediateStepPreviews`
- else only `stepId === 'validation'`

### Size gate

```bash
wc -l world-builder/core/derivedGeographyPipeline.js
# Must be ≤650 after #359 + #361
```

If still over budget after stage extraction, move `createInitialPipelineState` to `landmassPipelineState.js` (optional #361 follow-up — document in PR if done).

---

## Import graph (target)

```
derivedGeographyPipeline.js
  ├─ landmassPipelineRunner.js
  │    ├─ buildWorldDocumentFromPipelineState.js
  │    ├─ cloneWorldDocument.js
  │    └─ runPipelineStep (facade or landmassPipelineStep.js)
  ├─ landmassPipelineStageModules.js (#359)
  └─ landmassPipelineStageContracts.js

worker/derivedGeography.worker.js
  └─ runLandmassPipeline from facade (unchanged call site)

runDerivedGeographyInWorker.js
  └─ runLandmassPipeline / cloneWorldDocument
```

**Forbidden:** any new orchestrator → renderer import (ADR-0009).

---

## Worker and integration updates (#361.5)

| File | Change |
|------|--------|
| `worker/derivedGeography.worker.js` | Import paths if direct clone import added |
| `worker/derivedGeographyWorkerProtocol.js` | No logic change; verify payloads |
| `runDerivedGeographyInWorker.js` | Re-export stability |
| `worldBuilder.integration.test.js` | Full path smoke |

---

## Verification (#361.6 – #361.7)

```bash
wc -l world-builder/core/derivedGeographyPipeline.js
wc -l world-builder/core/cloneWorldDocument.js
wc -l world-builder/core/buildWorldDocumentFromPipelineState.js
wc -l world-builder/core/landmassPipelineRunner.js

npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js
npm run test:world-builder -- world-builder/worldBuilder.integration.test.js
npm run test:world-builder -- world-builder/worker/
```

No production file may exceed **1000 lines** (#372 audit).

---

## Line accounting estimate

| Module | Lines (approx) |
|--------|----------------|
| `cloneWorldDocument.js` | 70 |
| `buildWorldDocumentFromPipelineState.js` | 65 |
| `landmassPipelineRunner.js` | 280 |
| `derivedGeographyPipeline.js` (facade) | 120 |
| Six stage modules (#359) | 650 total |
| **Total** | similar to today, but no file >650 |

Current monolith **884** → facade **~120** achieves #361 acceptance criterion.

---

## Related docs

- [LANDMASS-STAGE-MODULES.md](./LANDMASS-STAGE-MODULES.md) — stage module registry
- [FILE-SIZE-BUDGET.md](./FILE-SIZE-BUDGET.md) — orchestrator line caps
