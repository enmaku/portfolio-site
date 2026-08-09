# Landmass pipeline stage modules

> **Purpose:** Specify the six derived-geography pipeline stages as first-class modules, mirroring the hydrology substep module pattern (#355–#356). Implements [#359](https://github.com/enmaku/portfolio-site/issues/359); contracts derive from modules in [#360](https://github.com/enmaku/portfolio-site/issues/360).
>
> **Authoritative code today:** `derivedGeographyPipeline.js` (inline step bodies + switch dispatch) and `landmassPipelineStageContracts.js` (hand-maintained contracts). **Target:** `world-builder/core/stages/*.js` + `landmassPipelineStageModules.js`.

---

## Relationship to hydrology substeps

Hydrology is itself **one landmass stage** (`hydrology`) that delegates to nine **substep modules** (`hydrologySubstepModules.js`). Landmass stage modules sit **above** hydrology:

```
DerivedGeographyParams
  └─ runLandmassPipelineRun / runLandmassPipeline
       └─ for each LandmassStageModule in LANDMASS_PIPELINE_STAGE_MODULES
            ├─ pickLandmassStageInput(module.id, state)   → narrow input record
            ├─ module.run(input, stepOptions?)              → partial state patch
            └─ assertLandmassStageOutputs(module.id, output)
```

| Layer | Registry | Module shape | Contract source |
|-------|----------|--------------|-----------------|
| Landmass stages (this doc) | `landmassPipelineStageModules.js` | `LandmassStageModule` | `deriveLandmassStageContract()` (#360) |
| Hydrology substeps | `hydrology/substeps/index.js` | `HydrologySubstepModule` | `HYDROLOGY_SUBSTEP_CONTRACTS` (derived) |

Landmass modules **must not** re-export hydrology internals; the `hydrology` stage module calls `runHydrologySubsteps` exactly as `runHydrologyStep` does today.

---

## Stage order and IDs

From `landmassPipelineTypes.js`:

```javascript
export const LANDMASS_PIPELINE_STEP_IDS = [
  'physicalTerrainBaseline',
  'erosion',
  'hydrology',
  'fieldRefresh',
  'coastAndResources',
  'validation',
]
```

`DERIVED_GEOGRAPHY_STEPS` in `derivedGeographyPipeline.js` maps these IDs to human labels via `LANDMASS_PIPELINE_STAGE_CONTRACTS[id].label`.

---

## LandmassStageModule interface

Mirror `HydrologySubstepModule` from `hydrologySubstepModules.js`, adapted for pipeline-scale steps:

```javascript
/**
 * @typedef {Object} LandmassStageModule
 * @property {LandmassPipelineStepId} id
 * @property {string} label
 * @property {Record<string, (state: DerivedGeographyPipelineState) => unknown>} inputs
 *   Narrow input selectors; Object.keys(inputs) forms the stage input contract.
 * @property {readonly string[]} outputKeys
 *   Keys merged into DerivedGeographyPipelineState after run.
 * @property {(input: StageInput, options?: PipelineStepOptions) => Record<string, unknown>} run
 * @property {(state: DerivedGeographyPipelineState) => boolean} [shouldSkip]
 * @property {(input: StageInput) => Record<string, unknown>} [runSkipped]
 */
```

### Design rules (match hydrology thermo standards)

1. **No god-bag input** — `run` receives only keys selected by `inputs`, not full pipeline state.
2. **Typed stage inputs** — each stage gets a dedicated typedef (see `landmassPipelineStageContracts.js` today); post-#360 these typedefs live beside modules and contracts derive from `inputs` keys.
3. **`outputKeys` is authoritative** — `assertLandmassStageOutputs` validates against module metadata, not a parallel table.
4. **`lastCompletedStep` is always an output** — set to this stage's `id` on success (including skip paths).
5. **Skip is explicit** — only `fieldRefresh` has a real skip path today (`!enableSeasonalHydrology`); express via `shouldSkip` + `runSkipped`, not silent no-ops inside `run`.

---

## Registry file

**Path:** `world-builder/core/landmassPipelineStageModules.js` (≤80 lines, import-only)

```javascript
import { physicalTerrainBaselineStage } from './stages/physicalTerrainBaselineStage.js'
import { erosionStage } from './stages/erosionStage.js'
import { hydrologyStage } from './stages/hydrologyStage.js'
import { fieldRefreshStage } from './stages/fieldRefreshStage.js'
import { coastAndResourcesStage } from './stages/coastAndResourcesStage.js'
import { validationStage } from './stages/validationStage.js'

/** @type {readonly LandmassStageModule[]} */
export const LANDMASS_PIPELINE_STAGE_MODULES = [
  physicalTerrainBaselineStage,
  erosionStage,
  hydrologyStage,
  fieldRefreshStage,
  coastAndResourcesStage,
  validationStage,
]
```

`runPipelineStep` becomes:

```javascript
export function runPipelineStep(state, stepId, options = {}) {
  const module = LANDMASS_PIPELINE_STAGE_MODULES.find((m) => m.id === stepId)
  if (!module) throw new Error(`Unknown pipeline step: ${stepId}`)
  const input = selectLandmassStageInput(module, state)
  const output = module.shouldSkip?.(state)
    ? module.runSkipped(input)
    : module.run(input, options)
  assertLandmassStageOutputs(stepId, output)
  return { ...state, ...output }
}
```

---

## Module 1 — `physicalTerrainBaseline`

| Field | Value |
|-------|-------|
| **ID** | `physicalTerrainBaseline` |
| **Label** | Physical terrain baseline |
| **Implementation** | `generatePhysicalTerrainBaseline` |
| **Spec** | [landmass/stage-specs/STAGE-physicalTerrainBaseline.md](./landmass/stage-specs/STAGE-physicalTerrainBaseline.md) |

### Input selectors

| Key | Source |
|-----|--------|
| `geographySeed` | `state.geographySeed` |
| `prevailingWindDegrees` | `state.prevailingWindDegrees` |
| `options` | `state.options` |
| `width` | `state.width` |
| `height` | `state.height` |

### Outputs

| Key | Type / role |
|-----|-------------|
| `baselineDoc` | Full baseline `WorldDocument` from generator |
| `fields` | `baselineDoc.fields` |
| `biomes` | `baselineDoc.biomes` |
| `lastCompletedStep` | `'physicalTerrainBaseline'` |

### Preconditions

None — first stage. `createInitialPipelineState` leaves `baselineDoc: null`.

### Notes

Does not set `pipelineStage` on world document until `buildWorldDocumentFromPipelineState`; baseline doc carries `generatedAt` timestamp reused in final assembly.

---

## Module 2 — `erosion`

| Field | Value |
|-------|-------|
| **ID** | `erosion` |
| **Label** | Erosion |
| **Implementation** | `applyErosion` + `refreshClimateScalarsAfterElevationMutation` + `classifyBiomesFromFields` |
| **Spec** | [landmass/stage-specs/STAGE-erosion.md](./landmass/stage-specs/STAGE-erosion.md) |

### Input selectors

Requires `state.lastCompletedStep === 'physicalTerrainBaseline'` and `state.baselineDoc`.

| Key | Source |
|-----|--------|
| Params | `geographySeed`, `prevailingWindDegrees`, `options`, `width`, `height` |
| `baselineDoc` | `state.baselineDoc` |

### Outputs

| Key | Role |
|-----|------|
| `erodedElevation` | Post-erosion height field |
| `erosionSnapshots` | Per-iteration elevation snapshots |
| `erosionStepCount` | Iteration count for validation report |
| `workingElevation` | Alias of eroded elevation (hydrology input) |
| `fields` | Climate scalars refreshed after elevation mutation |
| `biomes` | Re-classified from preview fields |
| `lastCompletedStep` | `'erosion'` |

### Notes

Salinity and other ocean-linked scalars refresh here so erosion previews show coherent coast climate (`elevationMutationClimateRefresh.test.js`).

---

## Module 3 — `hydrology`

| Field | Value |
|-------|-------|
| **ID** | `hydrology` |
| **Label** | Hydrology |
| **Implementation** | `buildPipelineStateForHydrologySubsteps` + `runHydrologySubsteps` |
| **Spec** | [landmass/stage-specs/STAGE-hydrology.md](./landmass/stage-specs/STAGE-hydrology.md) |

### Input selectors

Requires `state.lastCompletedStep === 'erosion'`, `baselineDoc`, `erodedElevation`.

| Key | Source |
|-----|--------|
| Params | `geographySeed`, `prevailingWindDegrees`, `options`, `width`, `height` |
| `baselineDoc` | `state.baselineDoc` |
| `erodedElevation` | `state.erodedElevation` |
| `fields` | `state.fields` (erosion preview; may be null — hydrology rebuilds) |

### Outputs

All hydrology substep products folded into pipeline state:

`lakeMask`, `lakes`, `lakeMeta`, `lakeIdByCell`, `hydrologyStats`, `workingElevation`, `riverGraph`, `simulationRiverMask`, `riverNetworkMask`, `riverCorridorMask`, `channelWidth`, `flowDirection`, `fields`, `biomes`, `hydrologySubstepTimings`, `lastCompletedStep: 'hydrology'`.

### Step options

Only this stage receives `PipelineStepOptions` from the orchestrator runner:

- `onSubstepStart`, `onSubstepProgress`, `onSubstepComplete`, `onSubstepPrepare`
- `shouldCancel` (wired from landmass pipeline callbacks)

### Notes

When `enableSeasonalHydrology` is off, hydrology exit is **authoritative** for climate scalars and biomes. `fieldRefresh` becomes a pass-through (#360 contract tests document this).

---

## Module 4 — `fieldRefresh`

| Field | Value |
|-------|-------|
| **ID** | `fieldRefresh` |
| **Label** | Seasonal climate annualization |
| **Implementation** | `deriveAnnualMeanClimate` + `classifyBiomesWithHydrology` (seasonal path only) |
| **Spec** | [landmass/stage-specs/STAGE-fieldRefresh.md](./landmass/stage-specs/STAGE-fieldRefresh.md) |

### Input selectors

Requires hydrology outputs: `workingElevation`, `lakeMask`, `riverNetworkMask`, `fields.drainage`, `biomes`.

| Key | Source |
|-----|--------|
| `geographySeed`, `options`, `width`, `height` | state |
| `lakeMask`, `riverNetworkMask`, `fields`, `biomes` | state |
| `riverCorridorMask`, `flowDirection` | state (nullable) |

### Skip path

```javascript
shouldSkip: (state) => !state.options.enableSeasonalHydrology,
runSkipped: (input) => ({
  fields: input.fields,
  biomes: input.biomes,
  lastCompletedStep: 'fieldRefresh',
}),
```

### Active path outputs

Annualized `rainfall` / `temperature` in `fields`; biomes from `classifyBiomesWithHydrology` using lake and river corridor masks.

---

## Module 5 — `coastAndResources`

| Field | Value |
|-------|-------|
| **ID** | `coastAndResources` |
| **Label** | Coast and resources |
| **Implementation** | coast navigability, coastal/salt nodes, arable/metals/timber rasters |
| **Spec** | [landmass/stage-specs/STAGE-coastAndResources.md](./landmass/stage-specs/STAGE-coastAndResources.md) |

### Input selectors

Requires `fieldRefresh` complete; needs `workingElevation`, `fields`, `riverGraph`, `biomes`.

Uses `riverCorridorMask ?? riverNetworkMask` for arable river proximity (same fallback as current `runCoastAndResourcesStep`).

### Outputs

`coastNavigability`, `coastalNodes`, `saltNodes`, `arableRaster`, `metalsRaster`, `metalNodes`, `timberRaster`, `lastCompletedStep: 'coastAndResources'`.

---

## Module 6 — `validation`

| Field | Value |
|-------|-------|
| **ID** | `validation` |
| **Label** | Geography validation |
| **Implementation** | `assembleRiverNetworkFromFields` + `buildGenerationReport` |
| **Spec** | [landmass/stage-specs/STAGE-validation.md](./landmass/stage-specs/STAGE-validation.md) |

### Input selectors

Requires coast/resources outputs plus hydrology timing/stats for report.

River network assembly prefers `simulationRiverMask ?? riverNetworkMask` (simulation-first per #365).

### Outputs

`generationReport`, `lastCompletedStep: 'validation'`.

Completing this stage sets `buildWorldDocumentFromPipelineState` → `pipelineStage: PIPELINE_STAGE_DERIVED_GEOGRAPHY`.

---

## Contract derivation (#360)

Replace hand-maintained `LANDMASS_PIPELINE_STAGE_CONTRACTS` object:

```javascript
export function deriveLandmassStageContract(module) {
  return {
    id: module.id,
    label: module.label,
    inputKeys: Object.keys(module.inputs),
    outputKeys: [...module.outputKeys],
  }
}

export const LANDMASS_PIPELINE_STAGE_CONTRACTS = Object.fromEntries(
  LANDMASS_PIPELINE_STAGE_MODULES.map((m) => [m.id, deriveLandmassStageContract(m)]),
)
```

`pickLandmassStageInput(stepId, state)` becomes `selectLandmassStageInput(module, state)`:

```javascript
function selectLandmassStageInput(module, state) {
  /** @type {Record<string, unknown>} */
  const input = {}
  for (const [key, selector] of Object.entries(module.inputs)) {
    input[key] = selector(state)
  }
  return input
}
```

Precondition throws (e.g. "erosion required before hydrology") move into selectors or a shared `assertStagePreconditions(module, state)` called before input selection.

---

## File layout after #359

```
world-builder/core/
  stages/
    physicalTerrainBaselineStage.js   (≤120 lines)
    erosionStage.js                   (≤120 lines)
    hydrologyStage.js                 (≤80 lines — delegate only)
    fieldRefreshStage.js              (≤100 lines)
    coastAndResourcesStage.js         (≤150 lines)
    validationStage.js                (≤100 lines)
  landmassPipelineStageModules.js     (≤80 lines)
  landmassPipelineStageContracts.js   (derive + pickers; shrink post-#360)
  derivedGeographyPipeline.js       (orchestrator; slim post-#361)
```

---

## Testing expectations

| Test file | What it guards |
|-----------|----------------|
| `runLandmassPipeline.test.js` | Full run, cancel, retry, sync vs async runner parity |
| `derivedGeographyPipeline.test.js` | Step previews, clone independence, hydrology timings |
| `landmassPipelineStageContracts.test.js` | Contract derivation, precondition errors (#360) |

No new copy-assertion tests. Behavior unchanged for default generation and validation-exhausted path.

---

## Migration checklist (#359 sub-sub-steps)

1. Extract each `run*Step` body from `derivedGeographyPipeline.js` into `stages/*Stage.js`.
2. Define `inputs` selectors mirroring current `pick*StageInput` functions.
3. Register modules in `landmassPipelineStageModules.js`.
4. Replace `executeLandmassPipelineStage` switch with module lookup.
5. Keep exports stable: `runPipelineStep`, `DERIVED_GEOGRAPHY_STEPS`, re-export contracts.
6. Run `npm run test:world-builder` and `npm run check:world-builder-file-size`.

---

## Related docs

- [ORCHESTRATOR-DECOMPOSITION.md](./ORCHESTRATOR-DECOMPOSITION.md) — runner extraction
- [landmass/stage-specs/](./landmass/stage-specs/) — per-stage deep specs
- [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) — pipeline test matrix
