# Hydrology substep file map

> **Issue:** [#356](https://github.com/enmaku/portfolio-site/issues/356) — split monolithic substep modules  
> **Pre-split source:** `world-builder/core/hydrology/hydrologySubstepModules.js` (783 lines)  
> **Depends on:** [#355](https://github.com/enmaku/portfolio-site/issues/355) typed stages

This document specifies the target file layout under `world-builder/core/hydrology/substeps/` after the monolithic module registry is decomposed into one file per substep.

---

## Table of contents

1. [Goals](#goals)
2. [Directory layout](#directory-layout)
3. [Registry and types](#registry-and-types)
4. [Shared helpers](#shared-helpers)
5. [Per-file specifications](#per-file-specifications)
6. [Import graph](#import-graph)
7. [Line budget](#line-budget)
8. [Shim and migration](#shim-and-migration)
9. [Test file mapping](#test-file-mapping)
10. [Forbidden patterns](#forbidden-patterns)
11. [Verification commands](#verification-commands)

---

## Goals

1. One substep implementation per file — readable, reviewable, independently diffable.
2. Import-only registry (`substeps/index.js`) — no logic in the barrel.
3. Preserve exact runtime behavior — tests pass with import path updates only.
4. Typed module exports aligned with `hydrologyWorldTypes.js` from #355.
5. Delete or shim `hydrologySubstepModules.js` — no duplicate module definitions.

---

## Directory layout

```
world-builder/core/hydrology/
├── hydrologySubsteps.js              # runner (unchanged behavior)
├── hydrologySubstepContracts.js      # derived contracts
├── hydrologyWorldTypes.js            # staged typedefs (#355)
├── buildPipelineStateFromHydrologyWorld.js
├── baselineDrainageFromState.js      # extracted helper (#356.11)
├── hydrologySubstepModules.js        # DELETE or thin re-export shim (#356.12)
└── substeps/
    ├── index.js                      # HYDROLOGY_SUBSTEP_MODULES registry
    ├── moduleTypes.js                # HydrologySubstepModule typedef (#355.2)
    ├── hydrologyFillSubstep.js
    ├── hydrologyClimateSubstep.js
    ├── hydrologySeasonalSubstep.js
    ├── hydrologyRouteSubstep.js
    ├── hydrologyInciseSubstep.js
    ├── hydrologyExtractSubstep.js
    ├── hydrologyRefineSubstep.js
    ├── hydrologySettleSubstep.js
    └── hydrologyPaintSubstep.js
```

Per-substep narrative specs live in `world-builder/docs/hydrology/substep-specs/SUBSTEP-<id>.md`.

---

## Registry and types

### `substeps/moduleTypes.js`

Exports:

- `HydrologySubstepShared`
- `HydrologySubstepModule` (generic)
- Re-exports `HydrologySubstepId` from `hydrologySubsteps.js` or defines locally

No runtime values — typedefs only.

### `substeps/index.js` (≤80 lines)

```javascript
import { hydrologyFillSubstep } from './hydrologyFillSubstep.js'
// … eight more imports …

/** @type {readonly HydrologySubstepModule[]} */
export const HYDROLOGY_SUBSTEP_MODULES = [
  hydrologyFillSubstep,
  hydrologyClimateSubstep,
  hydrologySeasonalSubstep,
  hydrologyRouteSubstep,
  hydrologyInciseSubstep,
  hydrologyExtractSubstep,
  hydrologyRefineSubstep,
  hydrologySettleSubstep,
  hydrologyPaintSubstep,
]

export const HYDROLOGY_SUBSTEP_MODULE_BY_ID = Object.fromEntries(
  HYDROLOGY_SUBSTEP_MODULES.map((m) => [m.id, m]),
)

export { selectHydrologySubstepInput } from '../selectHydrologySubstepInput.js'
```

Registry file must contain **imports and array literal only** — no helper functions, no side effects.

`selectHydrologySubstepInput` may live in its own file or remain in runner-adjacent module (#355.3).

---

## Shared helpers

### `baselineDrainageFromState.js` (≤60 lines)

Extracted from current `hydrologySubstepModules.js`:

```javascript
/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {Float32Array | null}
 */
export function baselineDrainageFromState(state) {
  return state.baselineDoc?.fields.drainage ?? state.fields?.drainage ?? null
}
```

Used by: climate, seasonal, route, extract, settle substeps.

### Not extracted to substeps/

These remain in sibling hydrology modules and are imported by individual substep files:

| Module | Used by |
| --- | --- |
| `fillLakes.js` | hydrologyFill |
| `refreshFieldsAfterErosion.js` | hydrologyClimate |
| `deriveSnowCapMask.js` | hydrologyClimate |
| `computeCellRunoff.js` | hydrologySeasonal |
| `simulateSeasonalHydrology.js` | hydrologySeasonal |
| `deriveBasinCatchments.js` | hydrologySeasonal |
| `flowField.js` | hydrologyRoute, hydrologyExtract, hydrologySettle |
| `buildRiverNetworkMask.js` | hydrologyRoute |
| `seededTemporaryRiverCarve.js` | hydrologyIncise |
| `extractRiverNetworkFromIncisedChannels.js` | hydrologyExtract |
| `riverNetworkLegacyMeanders.js` | hydrologyRefine |
| `settleLakeEquilibrium.js` | hydrologySettle |
| `deriveDrainageFromFlow.js` | hydrologySettle |
| `buildRiverGraph.js` | hydrologySettle |
| `riverCorridorDisplay.js` | hydrologyPaint |
| `riverNetwork.js` | hydrologyPaint |
| `riverMaskLifecycle.js` | route, incise, extract, refine, paint |
| `lakeDisplayCoherence.js` | hydrologySettle |

---

## Per-file specifications

Each substep file exports a single `/** @type {HydrologySubstepModule} */` constant named `hydrology<Name>Substep`.

### `hydrologyFillSubstep.js` (≤250 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyFill` |
| label | Fill lakes |
| input selectors | `options`, `width`, `height`, `erodedElevation` |
| outputKeys | `ocean`, `lakeMask`, `lakes`, `lakeMeta`, `hydrologyStats`, `filledElevation`, `spillOutlet`, `lakeIdByCell`, `catchmentCellsByLake` |
| shared deps | `flowFieldSession.deriveOceanMask` |
| primary imports | `fillLakes.js`, `flowField.js` |

### `hydrologyClimateSubstep.js` (≤200 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyClimate` |
| input selectors | `geographySeed`, `prevailingWindDegrees`, `options`, `width`, `height`, `erodedElevation`, `baselineDrainage` |
| outputKeys | `temperature`, `rainfall`, `snowCapMask`, `meltContribution` |
| primary imports | `refreshFieldsAfterErosion.js`, `deriveSnowCapMask.js`, `baselineDrainageFromState.js` |

### `hydrologySeasonalSubstep.js` (≤200 lines)

| Property | Value |
| --- | --- |
| id | `hydrologySeasonal` |
| input selectors | 18 keys — see SUBSTEP-hydrologySeasonal.md |
| outputKeys | `effectiveRunoff`, `overflowLakeIds`, `filledElevation`, `lakeMeta`, `lakes`, `catchmentCellsByLake`, `hydrologyStats` |
| branch | non-seasonal early return vs full `simulateSeasonalHydrology` |

### `hydrologyRouteSubstep.js` (≤250 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyRoute` |
| outputKeys | `flowDirection`, `flowAccumulation`, `lakeOcean`, `riverMask.sketch` |
| shared mutation | `setRiverMaskStage(pipeline, 'sketch', …)` |
| flow solve | #1 — `FLOW_RECOMPUTE_STAGES.hydrologyRoute` |

### `hydrologyInciseSubstep.js` (≤200 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyIncise` |
| outputKeys | `settledElevation`, `riverMask.incised` |
| reads pipeline | `requireRiverMaskStage(pipeline, 'sketch')` |
| progress | forwards `onProgress` to carve |

### `hydrologyExtractSubstep.js` (≤200 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyExtract` |
| outputKeys | `settledFlowDirection`, `settledFlowAccumulation`, `settledOcean`, `riverMask.settled`, `channelWidth`, `settledRiverGraph` |
| flow solve | #2 — inside `extractRiverNetworkFromIncisedChannels` |

### `hydrologyRefineSubstep.js` (≤200 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyRefine` |
| outputKeys | `settledElevation` (optional), `riverMask.presentation` |
| skip | `shouldSkip`, `runSkipped`, `skipTransition: skipRefine` |
| reads pipeline | `requireRiverMaskStage(pipeline, 'settled')` |

### `hydrologySettleSubstep.js` (≤250 lines)

| Property | Value |
| --- | --- |
| id | `hydrologySettle` |
| outputKeys | 10 data keys — see HYDROLOGY-TYPED-STAGES.md |
| flow solve | #3 — `FLOW_RECOMPUTE_STAGES.hydrologySettle` |
| display mask | `resolveDisplayRiverNetworkMaskFromPipeline` |

### `hydrologyPaintSubstep.js` (≤250 lines)

| Property | Value |
| --- | --- |
| id | `hydrologyPaint` |
| outputKeys | `riverMask.painted`, `riverNetwork` |
| progress | 0–0.92 corridor build, 1.0 on complete |

---

## Import graph

```
hydrologySubsteps.js
  └── substeps/index.js
        ├── hydrologyFillSubstep.js
        ├── hydrologyClimateSubstep.js
        ├── … (7 more)
        └── moduleTypes.js (types only)

hydrologySubstepContracts.js
  └── substeps/index.js (HYDROLOGY_SUBSTEP_MODULES)

hydrologySubstepModules.test.js
  └── substeps/index.js (after migration)

derivedGeographyPipeline.js
  └── hydrologySubsteps.js (unchanged)
```

**Rule:** substep files import **down** into hydrology algorithms and **sideways** into `baselineDrainageFromState.js`, `riverMaskLifecycle.js`, `flowField.js`. They must not import `hydrologySubsteps.js` (cycle).

---

## Line budget

Issue #356 AutoVerify:

```bash
wc -l world-builder/core/hydrology/substeps/*.js
```

| File | Max lines |
| --- | --- |
| `index.js` | 80 |
| `moduleTypes.js` | 120 |
| `hydrologyFillSubstep.js` | 250 |
| `hydrologyClimateSubstep.js` | 200 |
| `hydrologySeasonalSubstep.js` | 200 |
| `hydrologyRouteSubstep.js` | 250 |
| `hydrologyInciseSubstep.js` | 200 |
| `hydrologyExtractSubstep.js` | 200 |
| `hydrologyRefineSubstep.js` | 200 |
| `hydrologySettleSubstep.js` | 250 |
| `hydrologyPaintSubstep.js` | 250 |
| `baselineDrainageFromState.js` | 60 |

Total substep implementations ≈ 1,800 lines vs 783 monolithic — overhead from explicit imports and JSDoc is expected.

---

## Shim and migration

### Phase A (#355) — types only

Keep monolithic `hydrologySubstepModules.js` until types land. No file split yet.

### Phase B (#356) — extract files

Sub-sub-steps 356.1–356.9: one extraction commit per substep (or batched pairs).

356.10: create `substeps/index.js`.

356.11: extract `baselineDrainageFromState.js`.

356.12: replace `hydrologySubstepModules.js` body with:

```javascript
export {
  HYDROLOGY_SUBSTEP_MODULES,
  HYDROLOGY_SUBSTEP_MODULE_BY_ID,
  selectHydrologySubstepInput,
} from './substeps/index.js'
```

356.13: update imports repo-wide; grep:

```bash
rg hydrologySubstepModules world-builder/ --glob '*.js'
```

Hits allowed only in changelog/shim re-export — not in new call sites.

---

## Test file mapping

| Test file | What it validates post-split |
| --- | --- |
| `hydrologySubsteps.test.js` | full runner, 3 flow solves, skip refine, cancel |
| `hydrologySubstepModules.test.js` | per-module composition, nullable context |
| `hydrologySubstepContracts.test.js` | derived contracts match modules |
| `hydrologySubstepModules.test.js` | rename import to `substeps/index.js` |

No test logic changes — import path updates only.

---

## Forbidden patterns

1. **Logic in `index.js`** — registry array only.
2. **Duplicate module definitions** — single source in `hydrology*Substep.js`.
3. **Cross-substep imports** — `hydrologyRouteSubstep.js` must not import from `hydrologyFillSubstep.js`.
4. **Barrel re-export of algorithms** — do not re-export `fillLakes` from substep files.
5. **Renderer imports** — unchanged global forbidden.
6. **Growing monolith** — do not add new substeps to legacy `hydrologySubstepModules.js` after split starts.

---

## Verification commands

```bash
# Line counts
wc -l world-builder/core/hydrology/substeps/*.js

# No monolith references
rg hydrologySubstepModules world-builder/ --glob '*.js' | rg -v 'hydrologySubstepModules.js'

# Tests
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepModules.test.js
npm run test:world-builder

# Lint
npx eslint --max-warnings 0 world-builder/core/hydrology/substeps/*.js
```

---

## Cross-reference: substep spec documents

| File | Substep id |
| --- | --- |
| [SUBSTEP-hydrologyFill.md](./hydrology/substep-specs/SUBSTEP-hydrologyFill.md) | hydrologyFill |
| [SUBSTEP-hydrologyClimate.md](./hydrology/substep-specs/SUBSTEP-hydrologyClimate.md) | hydrologyClimate |
| [SUBSTEP-hydrologySeasonal.md](./hydrology/substep-specs/SUBSTEP-hydrologySeasonal.md) | hydrologySeasonal |
| [SUBSTEP-hydrologyRoute.md](./hydrology/substep-specs/SUBSTEP-hydrologyRoute.md) | hydrologyRoute |
| [SUBSTEP-hydrologyIncise.md](./hydrology/substep-specs/SUBSTEP-hydrologyIncise.md) | hydrologyIncise |
| [SUBSTEP-hydrologyExtract.md](./hydrology/substep-specs/SUBSTEP-hydrologyExtract.md) | hydrologyExtract |
| [SUBSTEP-hydrologyRefine.md](./hydrology/substep-specs/SUBSTEP-hydrologyRefine.md) | hydrologyRefine |
| [SUBSTEP-hydrologySettle.md](./hydrology/substep-specs/SUBSTEP-hydrologySettle.md) | hydrologySettle |
| [SUBSTEP-hydrologyPaint.md](./hydrology/substep-specs/SUBSTEP-hydrologyPaint.md) | hydrologyPaint |

Each spec duplicates the authoritative `inputs`, `outputKeys`, and behavioral notes from `hydrologySubstepModules.js` for reviewers who do not read source during mini-review.
