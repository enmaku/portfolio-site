# Hydrology typed stage outputs

> **Issue:** [#355](https://github.com/enmaku/portfolio-site/issues/355) — eliminate the hydrology god-bag  
> **Authoritative module source:** `world-builder/core/hydrology/hydrologySubstepModules.js`  
> **Contract derivation:** `world-builder/core/hydrology/hydrologySubstepContracts.js`  
> **Runner:** `world-builder/core/hydrology/hydrologySubsteps.js`

This document is the canonical specification for replacing the current `HydrologyWorld` god-bag with nine explicit stage types—one per substep boundary—and for threading shared session objects separately from accumulated world fields.

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Current god-bag shape](#current-god-bag-shape)
3. [Target architecture](#target-architecture)
4. [Shared vs world](#shared-vs-world)
5. [Stage type catalog](#stage-type-catalog)
6. [Field lifecycle table](#field-lifecycle-table)
7. [River mask contract keys on world vs pipeline](#river-mask-contract-keys-on-world-vs-pipeline)
8. [Runner typing contract](#runner-typing-contract)
9. [Substep module typing contract](#substep-module-typing-contract)
10. [Forbidden patterns](#forbidden-patterns)
11. [Migration steps 355.1–355.8](#migration-steps-35513558)
12. [Acceptance grep gates](#acceptance-grep-gates)
13. [Related documents](#related-documents)

---

## Problem statement

Hydrology runs as a composition of nine substeps. Each substep declares narrow `inputs` selectors and `outputKeys`, but the runner folds outputs into a single mutable object typed as:

```javascript
/**
 * @typedef {{
 *   state: DerivedGeographyPipelineState,
 *   width: number,
 *   height: number,
 * } & Record<string, unknown>} HydrologyWorld
 */
```

The `Record<string, unknown>` intersection makes every field optional at the type level, defeats IDE navigation, and allows silent key drift between substeps. Issue #355 replaces this with staged typedefs whose fields exist only after the producing substep has run.

---

## Current god-bag shape

### Fixed spine (always present at runner start)

| Field | Type | Source |
| --- | --- | --- |
| `state` | `DerivedGeographyPipelineState` | pipeline input |
| `width` | `number` | `state.width` |
| `height` | `number` | `state.height` |
| `riverMaskPipeline` | `RiverMaskPipeline` | `createRiverMaskPipeline()` in runner |

The runner also seeds `riverMaskPipeline` on the world object today. After #355, `riverMaskPipeline` lives only on `HydrologySubstepShared` (see [Shared vs world](#shared-vs-world)).

### Accumulated fields (appear only after their producing substep)

These keys are spread onto `world` after each substep via `world = { ...world, ...output }`. They are **not** present on the initial object.

#### After `hydrologyFill`

| Field | Type | outputKeys |
| --- | --- | --- |
| `ocean` | `boolean[]` | yes |
| `lakeMask` | `Uint8Array` | yes |
| `lakes` | `LakeRecord[]` | yes |
| `lakeMeta` | `LakeMetaRecord[]` | yes |
| `hydrologyStats` | `HydrologyPipelineStats` | yes |
| `filledElevation` | `Float32Array` | yes |
| `spillOutlet` | `Int32Array` | yes |
| `lakeIdByCell` | `Int32Array` | yes |
| `catchmentCellsByLake` | `Map<number, number[]>` or lake-index keyed structure | yes |

#### After `hydrologyClimate`

| Field | Type | outputKeys |
| --- | --- | --- |
| `temperature` | `Float32Array` | yes |
| `rainfall` | `Float32Array` | yes |
| `snowCapMask` | `Uint8Array` | yes |
| `meltContribution` | `Float32Array` | yes |

#### After `hydrologySeasonal`

| Field | Type | outputKeys | Notes |
| --- | --- | --- | --- |
| `effectiveRunoff` | `Float32Array` | yes | always produced |
| `overflowLakeIds` | `Set<number>` | yes | always produced |
| `filledElevation` | `Float32Array` | yes | seasonal path only |
| `lakeMeta` | `LakeMetaRecord[]` | yes | seasonal path only |
| `lakes` | `LakeRecord[]` | yes | seasonal path only |
| `catchmentCellsByLake` | basin map | yes | seasonal path only |
| `hydrologyStats` | `HydrologyPipelineStats` | yes | seasonal path only |

When `options.enableSeasonalHydrology` is false, only `effectiveRunoff` and `overflowLakeIds` are returned.

#### After `hydrologyRoute`

| Field | Type | outputKeys |
| --- | --- | --- |
| `flowDirection` | `Int16Array` | yes |
| `flowAccumulation` | `Float32Array` | yes |
| `lakeOcean` | `boolean[]` | yes |
| `riverMask.sketch` | `Uint8Array` | contract key only — stored on pipeline |

#### After `hydrologyIncise`

| Field | Type | outputKeys |
| --- | --- | --- |
| `settledElevation` | `Float32Array` | yes |
| `riverMask.incised` | `Uint8Array` | contract key only — stored on pipeline |

#### After `hydrologyExtract`

| Field | Type | outputKeys |
| --- | --- | --- |
| `settledFlowDirection` | `Int16Array` | yes |
| `settledFlowAccumulation` | `Float32Array` | yes |
| `settledOcean` | `boolean[]` | yes |
| `channelWidth` | `Float32Array` | yes |
| `settledRiverGraph` | `RiverGraph` | yes |
| `riverMask.settled` | `Uint8Array` | contract key only — stored on pipeline |

#### After `hydrologyRefine`

| Field | Type | outputKeys | Notes |
| --- | --- | --- | --- |
| `settledElevation` | `Float32Array` | optional | only when meander refine runs |
| `riverMask.presentation` | `Uint8Array` | contract key | always set (run or skip) |

Skip path: `runSkipped` calls `applySkipRefineToPipeline`; no world fields returned.

#### After `hydrologySettle`

| Field | Type | outputKeys |
| --- | --- | --- |
| `settledElevation` | `Float32Array` | yes |
| `lakes` | `LakeRecord[]` | yes |
| `lakeMeta` | `LakeMetaRecord[]` | yes |
| `spillOutlet` | `Int32Array` | yes |
| `settledFlowDirection` | `Int16Array` | yes |
| `settledFlowAccumulation` | `Float32Array` | yes |
| `settledOcean` | `boolean[]` | yes |
| `settledDrainage` | `Float32Array` | yes |
| `channelWidth` | `Float32Array` | yes (rebuilt) |
| `settledRiverGraph` | `RiverGraph` | yes (rebuilt) |

#### After `hydrologyPaint`

| Field | Type | outputKeys |
| --- | --- | --- |
| `riverNetwork` | `RiverNetwork` | yes |
| `riverMask.painted` | `Uint8Array` | contract key only — stored on pipeline |

---

## Target architecture

After #355, `hydrologyWorldTypes.js` exports:

```javascript
/** @typedef {Object} HydrologyWorldBase */
/** @typedef {HydrologyWorldBase & HydrologyFillOutputs} HydrologyAfterFill */
/** @typedef {HydrologyAfterFill & HydrologyClimateOutputs} HydrologyAfterClimate */
/** @typedef {HydrologyAfterClimate & HydrologySeasonalOutputs} HydrologyAfterSeasonal */
/** @typedef {HydrologyAfterSeasonal & HydrologyRouteOutputs} HydrologyAfterRoute */
/** @typedef {HydrologyAfterRoute & HydrologyInciseOutputs} HydrologyAfterIncise */
/** @typedef {HydrologyAfterIncise & HydrologyExtractOutputs} HydrologyAfterExtract */
/** @typedef {HydrologyAfterExtract & HydrologyRefineOutputs} HydrologyAfterRefine */
/** @typedef {HydrologyAfterRefine & HydrologySettleOutputs} HydrologyAfterSettle */
/** @typedef {HydrologyAfterSettle & HydrologyPaintOutputs} HydrologyAfterPaint */
```

`createInitialHydrologyWorld(state)` returns `HydrologyWorldBase` with `{ state, width, height }` only.

The runner folds stages:

```javascript
/** @type {HydrologyWorldBase} */
let world = createInitialHydrologyWorld(state)
// after fill:
world = /** @type {HydrologyAfterFill} */ ({ ...world, ...fillOutput })
// …
```

Each substep module is parameterized: `HydrologySubstepModule<InStage, OutPartial>`.

---

## Shared vs world

### HydrologySubstepShared (never folded into world)

| Field | Type | Lifetime | Mutated by |
| --- | --- | --- | --- |
| `flowFieldSession` | `FlowFieldSession` | entire hydrology run | route, extract, settle (via `recomputeFullFlow`) |
| `riverMaskPipeline` | `RiverMaskPipeline` | entire hydrology run | route, incise, extract, refine, paint |
| `onProgress` | `(progress: number) => void` | per substep invocation | incise, paint |

**Rule:** shared objects are passed as the second argument to `run` / `runSkipped`. They must not appear in `outputKeys` or be spread onto world.

### World fields (folded after each substep)

All keys listed in a module's `outputKeys` that are **not** river mask contract keys (`riverMask.*`) are spread onto the staged world object.

River mask contract keys are **declared** in `outputKeys` for contract derivation but **mutate** `shared.riverMaskPipeline` inside `run` rather than returning mask arrays on the world object.

---

## Stage type catalog

### HydrologyWorldBase

```javascript
/**
 * @typedef {Object} HydrologyWorldBase
 * @property {DerivedGeographyPipelineState} state
 * @property {number} width
 * @property {number} height
 */
```

Required inputs from erosion step: `state.erodedElevation`, `state.options`, `state.geographySeed`, `state.prevailingWindDegrees`, optional `state.fields.drainage` or `state.baselineDoc.fields.drainage`.

### HydrologyFillOutputs

Exact fields from `hydrologyFillSubstep.outputKeys`:

- `ocean: boolean[]`
- `lakeMask: Uint8Array`
- `lakes: LakeRecord[]`
- `lakeMeta: LakeMetaRecord[]`
- `hydrologyStats: HydrologyPipelineStats`
- `filledElevation: Float32Array`
- `spillOutlet: Int32Array`
- `lakeIdByCell: Int32Array`
- `catchmentCellsByLake: Record<number, number[]>`

`HydrologyPipelineStats` after fill contains: `breachCount`, `endorheicCount`, `endorheicFraction`, `lakeCount`.

### HydrologyClimateOutputs

Exact fields from `hydrologyClimateSubstep.outputKeys`:

- `temperature: Float32Array`
- `rainfall: Float32Array`
- `snowCapMask: Uint8Array`
- `meltContribution: Float32Array`

When `enableSeasonalHydrology` is true, `meltContribution` is a zeroed `Float32Array` placeholder; seasonal simulation replaces effective runoff later.

### HydrologySeasonalOutputs

Exact fields from `hydrologySeasonalSubstep.outputKeys`:

- `effectiveRunoff: Float32Array` — always
- `overflowLakeIds: Set<number>` — always
- `filledElevation?: Float32Array` — seasonal path
- `lakeMeta?: LakeMetaRecord[]` — seasonal path
- `lakes?: LakeRecord[]` — seasonal path
- `catchmentCellsByLake?: Record<number, number[]>` — seasonal path
- `hydrologyStats?: HydrologyPipelineStats` — seasonal path (extends fill stats)

Non-seasonal path: world retains fill-stage lake fields; only runoff fields update.

### HydrologyRouteOutputs

Exact fields from `hydrologyRouteSubstep.outputKeys` (data keys only):

- `flowDirection: Int16Array`
- `flowAccumulation: Float32Array`
- `lakeOcean: boolean[]`

Side effect: `riverMaskPipeline.sketch` set via `setRiverMaskStage(pipeline, 'sketch', mask)`.

Contract key in outputKeys: `riverMask.sketch` (via `riverMaskContractKey('sketch')`).

### HydrologyInciseOutputs

Exact fields from `hydrologyInciseSubstep.outputKeys`:

- `settledElevation: Float32Array`

Side effect: `riverMaskPipeline.incised`.

Contract key: `riverMask.incised`.

Reads: `requireRiverMaskStage(pipeline, 'sketch')` as `channelSeedMask`.

### HydrologyExtractOutputs

Exact fields from `hydrologyExtractSubstep.outputKeys`:

- `settledFlowDirection: Int16Array`
- `settledFlowAccumulation: Float32Array`
- `settledOcean: boolean[]`
- `channelWidth: Float32Array`
- `settledRiverGraph: RiverGraph`

Side effect: `riverMaskPipeline.settled`.

Contract key: `riverMask.settled`.

Triggers full flow solve #2 (`hydrologyExtract` / `extract-post-incision`) inside `extractRiverNetworkFromIncisedChannels`.

### HydrologyRefineOutputs

Exact fields from `hydrologyRefineSubstep.outputKeys`:

- `settledElevation?: Float32Array` — optional when meander refine mutates elevation

Side effect: `riverMaskPipeline.presentation` always.

Contract key: `riverMask.presentation`.

Skip when: `!enableMeanderRefine && !isCorridorAttractionEnabled(...)`.

Skip transition: `skipRefine` — copies settled → presentation.

### HydrologySettleOutputs

Exact fields from `hydrologySettleSubstep.outputKeys`:

- `settledElevation: Float32Array`
- `lakes: LakeRecord[]`
- `lakeMeta: LakeMetaRecord[]`
- `spillOutlet: Int32Array`
- `settledFlowDirection: Int16Array`
- `settledFlowAccumulation: Float32Array`
- `settledOcean: boolean[]`
- `settledDrainage: Float32Array`
- `channelWidth: Float32Array`
- `settledRiverGraph: RiverGraph`

Triggers full flow solve #3 (`hydrologySettle` / `settle-post-lake-equilibrium`).

Uses `resolveDisplayRiverNetworkMaskFromPipeline` for channel width and graph rebuild.

Side effect: may call `applyLakeSurfacesFromMeta` on elevation when lake metadata present.

### HydrologyPaintOutputs

Exact fields from `hydrologyPaintSubstep.outputKeys`:

- `riverNetwork: RiverNetwork`

Side effect: `riverMaskPipeline.painted`.

Contract key: `riverMask.painted`.

`RiverNetwork` fields: `width`, `height`, `simulationCenterline`, `centerline`, `corridor`, `flow`, `graph`.

---

## Field lifecycle table

Legend: **C** = created, **U** = updated in place (new array reference), **R** = read only, **—** = absent, **P** = pipeline mutation only.

| Field | Fill | Climate | Seasonal | Route | Incise | Extract | Refine | Settle | Paint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `state` | R | R | R | R | R | R | R | R | R |
| `width` / `height` | R | R | R | R | R | R | R | R | R |
| `ocean` | C | R | R | R | R | R | R | R | R |
| `lakeMask` | C | R | R | R | R | R | R | R | R |
| `lakes` | C | R | U* | R | R | R | R | U | R |
| `lakeMeta` | C | R | U* | R | R | R | R | U | R |
| `hydrologyStats` | C | R | U* | R | R | R | R | R | R |
| `filledElevation` | C | R | U* | R | — | — | — | — | — |
| `spillOutlet` | C | R | R | R | R | R | R | U | R |
| `lakeIdByCell` | C | R | R | R | R | R | R | R | R |
| `catchmentCellsByLake` | C | R | U* | R | R | R | R | R | R |
| `temperature` | — | C | R | R | R | R | R | R | R |
| `rainfall` | — | C | R | R | R | R | R | U | R |
| `snowCapMask` | — | C | R | R | R | R | R | R | R |
| `meltContribution` | — | C | R | R | R | R | R | R | R |
| `effectiveRunoff` | — | — | C | R | R | R | R | U | R |
| `overflowLakeIds` | — | — | C | R | R | R | R | R | R |
| `flowDirection` | — | — | — | C | R | — | — | — | — |
| `flowAccumulation` | — | — | — | C | R | — | — | — | — |
| `lakeOcean` | — | — | — | C | R | — | — | — | — |
| `settledElevation` | — | — | — | — | C | R | U? | U | R |
| `settledFlowDirection` | — | — | — | — | — | C | R | U | R |
| `settledFlowAccumulation` | — | — | — | — | — | C | R | U | R |
| `settledOcean` | — | — | — | — | — | C | R | U | R |
| `channelWidth` | — | — | — | — | — | C | R | U | R |
| `settledRiverGraph` | — | — | — | — | — | C | R | U | R |
| `settledDrainage` | — | — | — | — | — | — | — | C | R |
| `riverNetwork` | — | — | — | — | — | — | — | — | C |
| `riverMask.sketch` | — | — | — | P | R | — | — | — | — |
| `riverMask.incised` | — | — | — | — | P | R | — | — | — |
| `riverMask.settled` | — | — | — | — | — | P | R | R | R |
| `riverMask.presentation` | — | — | — | — | — | — | P | R | R |
| `riverMask.painted` | — | — | — | — | — | — | — | — | P |

\* Seasonal updates only when `enableSeasonalHydrology` is true.

### Elevation naming convention

| Name | Meaning | Active substeps |
| --- | --- | --- |
| `erodedElevation` | on `state` — pre-hydrology DEM | fill input |
| `filledElevation` | depression-filled DEM | fill → seasonal |
| `settledElevation` | post-incision / post-refine working DEM | incise → paint |

Route and extract solves use `filledElevation` and `settledElevation` respectively.

---

## River mask contract keys on world vs pipeline

`riverMaskContractKey(stage)` returns `riverMask.${stage}`.

These strings appear in `outputKeys` for **contract documentation** but are **not** world properties after fold:

| Contract key | Stage | Producer | Storage |
| --- | --- | --- | --- |
| `riverMask.sketch` | sketch | hydrologyRoute | `riverMaskPipeline.sketch` |
| `riverMask.incised` | incised | hydrologyIncise | `riverMaskPipeline.incised` |
| `riverMask.settled` | settled | hydrologyExtract | `riverMaskPipeline.settled` |
| `riverMask.presentation` | presentation | hydrologyRefine | `riverMaskPipeline.presentation` |
| `riverMask.painted` | painted | hydrologyPaint | `riverMaskPipeline.painted` |

`hydrologySubstepContracts.js` must continue deriving `outputKeys` from modules without a parallel manual table (#355.6).

World document export mapping (from `buildPipelineStateFromHydrologyWorld`):

| WorldDocument field | Source |
| --- | --- |
| `simulationRiverMask` | `riverNetwork.simulationCenterline` (= settled stage) |
| `riverNetworkMask` | `riverNetwork.centerline` (= presentation-or-settled) |
| `riverCorridorMask` | `riverNetwork.corridor` (= painted stage) |

---

## Runner typing contract

`runHydrologySubsteps(state, hooks)` in `hydrologySubsteps.js`:

```javascript
/**
 * @param {DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} [hooks]
 * @returns {{
 *   state: DerivedGeographyPipelineState,
 *   timings: HydrologySubstepTiming[],
 *   flowField: { fullFlowSolveCount: number, solveLog: FlowRecomputeLogEntry[] },
 * }}
 */
```

Internal loop (#355.4):

1. `createFlowFieldSession()` and `createRiverMaskPipeline()` once.
2. `world = createInitialHydrologyWorld(state)`.
3. For each module in `HYDROLOGY_SUBSTEP_MODULES` order:
   - evaluate `shouldSkip?.(world)`
   - `input = selectHydrologySubstepInput(module, world)` — typed to stage
   - `output = run(input, shared)` or `runSkipped`
   - `world = foldStage(world, output)` — must preserve stage typing
4. `buildPipelineStateFromHydrologyWorld(/** @type {HydrologyAfterPaint} */ (world))`.

Hooks receive `maskLifecycle: snapshotRiverMaskPipeline(riverMaskPipeline)` on complete.

Cancellation: `LandmassPipelineCancelledError` with current `world.state`.

---

## Substep module typing contract

Target definition in `substeps/moduleTypes.js` (#355.2):

```javascript
/**
 * @template {HydrologyWorldBase} InWorld
 * @template {Partial<Record<string, unknown>>} OutPartial
 * @typedef {Object} HydrologySubstepModule
 * @property {HydrologySubstepId} id
 * @property {string} label
 * @property {{ [K in keyof SubstepInputs]: (world: InWorld) => SubstepInputs[K] }} inputs
 * @property {readonly string[]} outputKeys
 * @property {(input: SubstepInputs, shared: HydrologySubstepShared) => OutPartial} run
 * @property {(world: InWorld) => boolean} [shouldSkip]
 * @property {(input: SubstepInputs, shared: HydrologySubstepShared) => OutPartial} [runSkipped]
 * @property {string} [skipTransition]
 */
```

**No `Record<string, any>` on public `run`.**

`selectHydrologySubstepInput` (#355.3) returns the precise input object keyed by `module.inputs` with values typed from selectors applied to `InWorld`.

---

## Forbidden patterns

### Type-level forbiddens (grep gate)

```bash
rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'
```

Must return zero hits in production hydrology code after #355.7.

### Architectural forbiddens

1. **God-bag fold without stage narrowing** — do not cast world to a wider type after each substep.
2. **Pipeline keys on world** — never spread `riverMask.*` masks onto world; only mutate `shared.riverMaskPipeline`.
3. **Shadow contract tables** — do not duplicate `outputKeys` in a second manual registry; derive from modules.
4. **Hidden flow solves** — every `recomputeFullFlow` must log to `flowFieldSession.solveLog` (see FLOW-FIELD-INVARIANTS.md).
5. **Presentation mask as simulation truth** — logistics and validation must read settled/simulation centerline, not presentation or painted masks.
6. **Renderer imports in core** — `world-builder/core/**` must not import from `world-builder/renderer/**`.
7. **Nullable context seeding** — do not pre-initialize substep output keys to `null` on world; fields appear only after production (test: `hydrologySubstepModules.test.js` composition test).

### Runner forbiddens

- Do not attach `flowFieldSession` or `riverMaskPipeline` to world after #355.
- Do not read arbitrary `world[key]` in `buildPipelineStateFromHydrologyWorld`; input type is `HydrologyAfterPaint` only (#355.5).

---

## Migration steps 355.1–355.8

### 355.1 — `hydrologyWorldTypes.js`

Create staged typedefs and `createInitialHydrologyWorld(state)`.

Deliverables:

- `HydrologyWorldBase` through `HydrologyAfterPaint`
- Per-substep output typedefs matching exact `outputKeys` data fields
- Zero `Record<string, unknown>`

### 355.2 — `substeps/moduleTypes.js`

Move `HydrologySubstepModule` and `HydrologySubstepShared` typedefs here.

Generics tie each module to input world stage and output partial.

### 355.3 — `selectHydrologySubstepInput`

Refactor to preserve selector key typing at module boundary.

Each selector `(world: InStage) => T` must accept only fields known at that stage.

### 355.4 — Runner fold in `hydrologySubsteps.js`

Replace `{ ...world, ...output }` with typed fold helper if needed.

Keep skip paths: `hydrologyRefine` `runSkipped` → `applySkipRefineToPipeline`.

Keep hook payloads unchanged.

Remove `riverMaskPipeline` from world initialization; pass via shared only.

### 355.5 — Extract `buildPipelineStateFromHydrologyWorld.js`

Move from inline function in `hydrologySubsteps.js`.

Parameter type: `HydrologyAfterPaint`.

Reads: `settledElevation`, `lakeIdByCell`, `lakeMeta`, `lakeMask`, `settledDrainage`, `riverNetwork`, `channelWidth`, `settledFlowDirection`, `hydrologyStats`, `lakes`, plus `world.state` spine.

Uses `getRiverMaskStage(shared.pipeline, 'painted')` via river network, not god-bag lookup.

### 355.6 — Contract derivation for pipeline-mutated keys

`hydrologySubstepContracts.js` continues mapping modules → contracts.

`outputKeys` includes `riverMask.*` contract keys even though masks live on pipeline.

Tests assert contract keys match module metadata.

### 355.7 — Remove god-bag from `hydrologySubstepModules.js`

Delete `HydrologyWorld` typedef with `Record<string, unknown>`.

Re-export types from `hydrologyWorldTypes.js` if shim needed.

Grep gate clean.

### 355.8 — Integration verification

```bash
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js
npm run test:world-builder
npx eslint --max-warnings 0 <changed-files>
```

---

## Acceptance grep gates

| Check | Command | Expected |
| --- | --- | --- |
| No god-bag | `rg 'Record<string, unknown>' world-builder/core/hydrology/` | 0 production hits |
| No any-run | `rg 'Record<string, any>' world-builder/core/hydrology/` | 0 production hits |
| Contracts derived | inspect `hydrologySubstepContracts.js` | imports modules only |
| Three solves | `hydrologySubsteps.test.js` | `fullFlowSolveCount === 3` |

---

## Related documents

| Document | Purpose |
| --- | --- |
| [HYDROLOGY-SUBSTEP-FILE-MAP.md](./HYDROLOGY-SUBSTEP-FILE-MAP.md) | post-#356 file layout |
| [RIVER-MASK-LIFECYCLE.md](./RIVER-MASK-LIFECYCLE.md) | mask stage semantics |
| [FLOW-FIELD-INVARIANTS.md](./FLOW-FIELD-INVARIANTS.md) | three full flow solves |
| [hydrology/substep-specs/](./hydrology/substep-specs/) | per-substep specs |
| [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) | hydrology seam tests |

---

## Appendix: canonical substep order

| Index | id | label |
| --- | --- | --- |
| 0 | `hydrologyFill` | Fill lakes |
| 1 | `hydrologyClimate` | Climate refresh |
| 2 | `hydrologySeasonal` | Seasonal hydrology |
| 3 | `hydrologyRoute` | Route runoff |
| 4 | `hydrologyIncise` | Incise channels |
| 5 | `hydrologyExtract` | Extract river graph |
| 6 | `hydrologyRefine` | Meander refine |
| 7 | `hydrologySettle` | Settle drainage |
| 8 | `hydrologyPaint` | Paint river corridors |

Authoritative registry: `HYDROLOGY_SUBSTEP_MODULES` in `hydrologySubstepModules.js`.
