# River mask lifecycle

> **Source:** `world-builder/core/hydrology/riverMaskLifecycle.js`  
> **Producer modules:** `hydrologySubstepModules.js` (route → paint)  
> **Related:** [#355](https://github.com/enmaku/portfolio-site/issues/355) typed stages, [#345](https://github.com/enmaku/portfolio-site/issues/345) world document export

River masks progress through five lifecycle stages stored on `RiverMaskPipeline`, a mutable object threaded via `HydrologySubstepShared`. Contract keys (`riverMask.<stage>`) appear in substep `outputKeys` for documentation and contract derivation but **mutate the pipeline** rather than folding onto the hydrology world object.

---

## Table of contents

1. [Overview](#overview)
2. [RiverMaskPipeline type](#rivermaskpipeline-type)
3. [Lifecycle order](#lifecycle-order)
4. [Simulation vs presentation split](#simulation-vs-presentation-split)
5. [Stage reference](#stage-reference)
6. [Contract keys vs mutation](#contract-keys-vs-mutation)
7. [Skip refine transition](#skip-refine-transition)
8. [Resolution helpers](#resolution-helpers)
9. [World document mapping](#world-document-mapping)
10. [Substep producer matrix](#substep-producer-matrix)
11. [Invariants and forbiddens](#invariants-and-forbiddens)
12. [Snapshot and testing](#snapshot-and-testing)

---

## Overview

Hydrology produces river geometry in two phases:

**Simulation stages** — tied to drainage physics and elevation mutation:

```
sketch (route) → incised (incise) → settled (extract)
```

**Presentation stages** — map display geometry; optional legacy meander heuristics:

```
presentation (refine | skipRefine) → painted (paint)
```

The pipeline object holds one `Uint8Array | null` per stage, keyed by stage name.

---

## RiverMaskPipeline type

```javascript
/**
 * @typedef {Object} RiverMaskPipeline
 * @property {Uint8Array | null} sketch
 * @property {Uint8Array | null} incised
 * @property {Uint8Array | null} settled
 * @property {Uint8Array | null} presentation
 * @property {Uint8Array | null} painted
 */
```

Created once per hydrology run:

```javascript
const riverMaskPipeline = createRiverMaskPipeline()
// all stages null initially
```

Mutated only via `setRiverMaskStage(pipeline, stage, mask)`.

---

## Lifecycle order

```javascript
export const RIVER_MASK_LIFECYCLE_ORDER = [
  'sketch',
  'incised',
  'settled',
  'presentation',
  'painted',
]
```

Stages must be populated in order for downstream `requireRiverMaskStage` calls. A missing stage throws:

```
Error: river mask stage <stage> required
```

---

## Simulation vs presentation split

| Category | Stages | Logistics / validation | Map display |
| --- | --- | --- | --- |
| Simulation | sketch, incised, settled | **settled** is canonical simulation centerline | not drawn directly |
| Presentation | presentation, painted | must not drive movement cost | centerline + corridor |

From `riverMaskLifecycle.js` header:

> `riverNetworkMask` = display centerline from presentation-or-settled  
> `riverCorridorMask` = painted stage only

`resolveSimulationRiverNetworkMaskFromPipeline` **always** returns `settled` — never presentation or painted.

---

## Stage reference

### `sketch`

| Attribute | Value |
| --- | --- |
| Producer | `hydrologyRoute` |
| Algorithm | `buildRiverNetworkMask` on route flow accumulation |
| Inputs | `flowAccumulation`, `flowDirection`, `lakeOcean`, `lakeMask`, optional overflow lakes |
| Purpose | Seed channel mask before incision |
| Contract key | `riverMask.sketch` |

### `incised`

| Attribute | Value |
| --- | --- |
| Producer | `hydrologyIncise` |
| Algorithm | `unionCorridorMasks(carved.corridorMask, deriveIncisedCorridorMask(...))` |
| Reads | `requireRiverMaskStage(pipeline, 'sketch')` as channel seed |
| Side effect | mutates `settledElevation` via stream-power carve |
| Contract key | `riverMask.incised` |

### `settled`

| Attribute | Value |
| --- | --- |
| Producer | `hydrologyExtract` |
| Algorithm | `extractRiverNetworkFromIncisedChannels` → `channelMask` |
| Flow solve | full recompute #2 on post-incision elevation |
| Contract key | `riverMask.settled` |
| Export | `simulationRiverMask` / `RiverNetwork.simulationCenterline` |

### `presentation`

| Attribute | Value |
| --- | --- |
| Producer | `hydrologyRefine` (or skip path) |
| Algorithm | corridor attraction ± meander refine |
| Reads | `requireRiverMaskStage(pipeline, 'settled')` |
| Skip | `applySkipRefineToPipeline` copies settled → presentation |
| Contract key | `riverMask.presentation` |
| Export | `riverNetworkMask` / `RiverNetwork.centerline` when refine enabled |

### `painted`

| Attribute | Value |
| --- | --- |
| Producer | `hydrologyPaint` |
| Algorithm | `buildPhysicalRiverCorridorMask` + `smoothRiverCorridorMaskForDisplay` |
| Reads display centerline | `resolveDisplayRiverNetworkMaskFromPipeline` |
| Contract key | `riverMask.painted` |
| Export | `riverCorridorMask` / `RiverNetwork.corridor` |

---

## Contract keys vs mutation

### Contract key format

```javascript
export const RIVER_MASK_CONTRACT_PREFIX = 'riverMask.'

export function riverMaskContractKey(stage) {
  return `${RIVER_MASK_CONTRACT_PREFIX}${stage}`
}
```

Examples: `riverMask.sketch`, `riverMask.painted`.

### Listed in outputKeys but not on world

Each producing substep includes the contract key in `outputKeys`:

```javascript
outputKeys: ['flowDirection', 'flowAccumulation', 'lakeOcean', riverMaskContractKey('sketch')]
```

`hydrologySubstepContracts.js` derives:

```javascript
outputKeys: [...module.outputKeys]
```

**Mutation site** (route example):

```javascript
setRiverMaskStage(riverMaskPipeline, 'sketch', sketchRiverNetworkMask)
return { flowDirection, flowAccumulation, lakeOcean }
// no sketch mask in return object
```

### Why both?

1. **Contract visibility** — downstream issues (#356, #357) read derived contracts without parsing `run` bodies.
2. **No god-bag pollution** — masks stay on pipeline, not spread onto typed world.
3. **Snapshot hooks** — `onSubstepComplete` exposes `maskLifecycle: snapshotRiverMaskPipeline(...)`.

### Type guard helpers

```javascript
isRiverMaskContractKey(key)       // key.startsWith('riverMask.')
riverMaskStageFromContractKey(key) // strips prefix → RiverMaskLifecycleStage
```

---

## Skip refine transition

When `hydrologyRefine` is skipped:

```javascript
shouldSkip: (world) =>
  !world.state.options.enableMeanderRefine &&
  !isCorridorAttractionEnabled(world.width, world.state.options.riverAttractionRadiusScale)
```

Skip handler:

```javascript
runSkipped(_input, { riverMaskPipeline }) {
  applySkipRefineToPipeline(riverMaskPipeline)
  return {}
}
```

`applySkipRefineToPipeline`:

```javascript
const settled = getRiverMaskStage(pipeline, 'settled')
if (!settled) throw new Error('skipRefine requires settled river mask')
setRiverMaskStage(pipeline, 'presentation', settled)
```

Transition label: `RIVER_MASK_SKIP_REFINE_TRANSITION = 'skipRefine'`.

Hooks receive `transition: 'skipRefine'` on complete when skipped.

---

## Resolution helpers

### Display centerline (presentation-or-settled)

```javascript
resolveDisplayRiverNetworkMask(presentationMask, settledMask)
// presentation if set, else settled (required)
```

Used by refine (input), settle (channel width), paint (corridor build).

### Simulation centerline (settled only)

```javascript
resolveSimulationRiverNetworkMaskFromPipeline(pipeline)
// requireRiverMaskStage(pipeline, 'settled')
```

Used by `assembleRiverNetwork` for `simulationCenterline`.

### Equality check

```javascript
riverMasksEqual(left, right) // byte-by-byte Uint8Array compare
```

Used in tests when skip refine should preserve settled === presentation.

---

## World document mapping

After hydrology completes, `buildPipelineStateFromHydrologyWorld` maps:

| WorldDocument field | Pipeline / RiverNetwork source |
| --- | --- |
| `simulationRiverMask` | settled stage via `RiverNetwork.simulationCenterline` |
| `riverNetworkMask` | presentation-or-settled via `RiverNetwork.centerline` |
| `riverCorridorMask` | painted via `RiverNetwork.corridor` |
| `riverGraph` | from `settledRiverGraph` / `RiverNetwork.graph` |

Biome classification reads painted corridor:

```javascript
riverCorridorMask: getRiverMaskStage(world.riverMaskPipeline, 'painted')
```

After #355, pipeline access moves to shared-only; biome step reads from `RiverNetwork.corridor`.

---

## Substep producer matrix

| Substep | Sets stage | Requires stage | Returns world fields |
| --- | --- | --- | --- |
| hydrologyRoute | sketch | — | flowDirection, flowAccumulation, lakeOcean |
| hydrologyIncise | incised | sketch | settledElevation |
| hydrologyExtract | settled | incised | settledFlow*, channelWidth, graph |
| hydrologyRefine | presentation | settled | settledElevation? |
| hydrologySettle | — | presentation or settled (display resolve) | settled* outputs |
| hydrologyPaint | painted | display centerline | riverNetwork |

---

## Invariants and forbiddens

1. **Never use presentation/painted for simulation validation** — logistics reads settled.
2. **Never skip settled** — presentation skip still requires settled populated.
3. **Do not store masks on HydrologyWorld** — pipeline only (#355).
4. **Do not manual-sync contract table** — derive from module `outputKeys`.
5. **Paint requires presentation or settled** — `resolveDisplayRiverNetworkMaskFromPipeline` before corridor build.

---

## Snapshot and testing

```javascript
snapshotRiverMaskPipeline(pipeline)
// → Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>
```

Runner hook payload:

```javascript
onSubstepComplete?.({
  // …
  maskLifecycle: snapshotRiverMaskPipeline(riverMaskPipeline),
})
```

Tests in `hydrologySubsteps.test.js` and `riverMaskLifecycle.test.js` verify:

- skip refine: `presentation` equals `settled`
- full refine: `presentation` may differ from `settled`
- painted corridor superset or smoothing of display centerline

See also [FLOW-FIELD-INVARIANTS.md](./FLOW-FIELD-INVARIANTS.md) for flow solve stages orthogonal to mask stages.
