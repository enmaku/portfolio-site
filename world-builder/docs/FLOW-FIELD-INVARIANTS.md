# Flow field invariants

> **Source:** `world-builder/core/hydrology/flowField.js`  
> **Regression issue:** [#357](https://github.com/enmaku/portfolio-site/issues/357)  
> **Test anchor:** `hydrologySubsteps.test.js` — `runHydrologySubsteps performs three full flow solves per world`

The hydrology pipeline performs exactly **three** uncached full D-infinity flow direction and accumulation solves per world generation. Every solve is logged on `FlowFieldSession.solveLog` with explicit stage and reason metadata. Hidden solves without log entries are forbidden.

---

## Table of contents

1. [FlowFieldSession](#flowfieldsession)
2. [Three full solves](#three-full-solves)
3. [Solve log schema](#solve-log-schema)
4. [Cache behavior](#cache behavior)
5. [Ocean mask derivation (non-solve)](#ocean-mask-derivation-non-solve)
6. [Stage ↔ elevation mapping](#stage--elevation-mapping)
7. [Seasonal hydrology invariant](#seasonal-hydrology-invariant)
8. [Forbidden patterns](#forbidden-patterns)
9. [Test assertions](#test-assertions)
10. [Debugging checklist](#debugging-checklist)

---

## FlowFieldSession

Created once per `runHydrologySubsteps` call:

```javascript
const flowFieldSession = createFlowFieldSession()
```

### API

| Method / property | Purpose |
| --- | --- |
| `deriveOceanMask(params)` | boolean ocean mask without full flow solve |
| `recomputeFullFlow(params)` | D-infinity direction + accumulation |
| `solveLog` | readonly array of `FlowRecomputeLogEntry` |
| `fullFlowSolveCount` | count of log entries where `cached === false` |

Passed via `HydrologySubstepShared` to substeps that need flow recomputation.

---

## Three full solves

### Solve 1 — hydrologyRoute

| Field | Value |
| --- | --- |
| Stage id | `FLOW_RECOMPUTE_STAGES.hydrologyRoute` → `'hydrologyRoute'` |
| Reason id | `FLOW_RECOMPUTE_REASONS.hydrologyRoute` → `'route-filled-dem'` |
| Caller | `hydrologyRouteSubstep.run` |
| Elevation input | `filledElevation` |
| Runoff input | `effectiveRunoff` |
| Outputs used | `flowDirection`, `flowAccumulation`, `lakeOcean` |
| Side effect | sketch river mask from accumulation |

### Solve 2 — hydrologyExtract

| Field | Value |
| --- | --- |
| Stage id | `FLOW_RECOMPUTE_STAGES.hydrologyExtract` → `'hydrologyExtract'` |
| Reason id | `FLOW_RECOMPUTE_REASONS.hydrologyExtract` → `'extract-post-incision'` |
| Caller | `extractRiverNetworkFromIncisedChannels` (invoked by hydrologyExtract) |
| Elevation input | `settledElevation` (post-incision DEM) |
| Outputs used | `settledFlowDirection`, `settledFlowAccumulation`, `settledOcean` |
| Side effect | settled river mask |

**Note:** solve 2 is delegated inside extract moduleEmpty, not directly in substep `run` body — still must log.

### Solve 3 — hydrologySettle

| Field | Value |
| --- | --- |
| Stage id | `FLOW_RECOMPUTE_STAGES.hydrologySettle` → `'hydrologySettle'` |
| Reason id | `FLOW_RECOMPUTE_REASONS.hydrologySettle` → `'settle-post-lake-equilibrium'` |
| Caller | `hydrologySettleSubstep.run` |
| Elevation input | post-`settleLakeEquilibrium` elevation |
| Outputs used | `settledFlowDirection`, `settledFlowAccumulation`, `settledOcean`, `settledDrainage` |

---

## Solve log schema

```javascript
/**
 * @typedef {Object} FlowRecomputeLogEntry
 * @property {FlowRecomputeStageId} stage
 * @property {string} reason
 * @property {boolean} cached
 */
```

Stage ids: `'hydrologyRoute' | 'hydrologyExtract' | 'hydrologySettle'`.

Reason ids: `'route-filled-dem' | 'extract-post-incision' | 'settle-post-lake-equilibrium'`.

### Expected uncached log for default generation

```javascript
[
  { stage: 'hydrologyRoute', reason: 'route-filled-dem', cached: false },
  { stage: 'hydrologyExtract', reason: 'extract-post-incision', cached: false },
  { stage: 'hydrologySettle', reason: 'settle-post-lake-equilibrium', cached: false },
]
```

`runHydrologySubsteps` return value:

```javascript
flowField: {
  fullFlowSolveCount: 3,
  solveLog: flowFieldSession.solveLog,
}
```

---

## Cache behavior

`recomputeFullFlow` memoizes on reference identity of cache key fields:

- `elevation`
- `seaLevel`
- `rainfall`
- `meltContribution`
- `cellRunoff`
- `soilDrainage`
- `soilDrainageScale`

If the same references are passed again, log entry has `cached: true` and `fullFlowSolveCount` does not increment.

Typical hydrology run: three distinct elevation arrays → three uncached solves.

Repeated call with identical params (tests): may produce cached entries — filter `!entry.cached` when asserting stage order.

---

## Ocean mask derivation (non-solve)

`hydrologyFill` calls:

```javascript
flowFieldSession.deriveOceanMask({
  elevation: erodedElevation,
  width, height,
  seaLevel: options.seaLevel,
})
```

This uses `isOceanCell` — **not** a full flow solve and **not** logged in `solveLog`.

Do not count toward `fullFlowSolveCount`.

---

## Stage ↔ elevation mapping

| Solve | Elevation field | Prior processing |
| --- | --- | --- |
| route | `filledElevation` | depression fill |
| extract | `settledElevation` | stream-power incision |
| settle | `settledElevation` (post lake equilibrium) | lake level settle + optional refine |

Route solve uses pre-incision filled DEM. Extract and settle use carved/settled DEM.

---

## Seasonal hydrology invariant

When `options.enableSeasonalHydrology` is true:

- Seasonal substep may update `filledElevation`, lakes, and stats
- **No additional full flow solves** beyond the baseline three
- Issue #357.4: assert `fullFlowSolveCount === 3` with seasonal enabled

Seasonal simulation affects runoff (`effectiveRunoff`) consumed by route solve #1, not additional solves mid-pipeline.

---

## Forbidden patterns

1. **Direct `computeFlowAccumulation` in substeps** without session logging — use `flowFieldSession.recomputeFullFlow`.
2. **Fourth uncached solve** on default path — investigate before merging.
3. **Stage/reason mismatch** — reason must match `FLOW_RECOMPUTE_REASONS[stage]`.
4. **Silent delegate solves** — wrappers must forward to session or push log entries.
5. **Counting deriveOceanMask** toward solve count.

---

## Test assertions

From `hydrologySubsteps.test.js`:

```javascript
assert.strictEqual(flowField.fullFlowSolveCount, 3)

const uncachedLog = flowField.solveLog.filter((entry) => !entry.cached)
assert.deepStrictEqual(
  uncachedLog.map((entry) => entry.stage),
  [
    FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    FLOW_RECOMPUTE_STAGES.hydrologyExtract,
    FLOW_RECOMPUTE_STAGES.hydrologySettle,
  ],
)
assert.deepStrictEqual(
  uncachedLog.map((entry) => entry.reason),
  [
    FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    FLOW_RECOMPUTE_REASONS.hydrologyExtract,
    FLOW_RECOMPUTE_REASONS.hydrologySettle,
  ],
)
```

Issue #357 extends `derivedGeographyPipeline.test.js` with the same invariant at full pipeline level.

---

## Debugging checklist

When `fullFlowSolveCount !== 3`:

1. Print full `solveLog` with cached flags.
2. Identify elevation reference changes between substeps.
3. Grep `recomputeFullFlow` and `computeFlowAccumulation` in hydrology/.
4. Verify extract delegate passes `flowFieldSession`.
5. Check for test-only double invocation of `runHydrologySubsteps` on shared session.

When cached count is unexpectedly high:

1. Confirm elevation arrays are new Float32Array instances after mutation substeps.
2. Lake settle and refine should clone or replace elevation buffers.

---

## Related documents

- [HYDROLOGY-TYPED-STAGES.md](./HYDROLOGY-TYPED-STAGES.md) — which substeps read flow outputs
- [RIVER-MASK-LIFECYCLE.md](./RIVER-MASK-LIFECYCLE.md) — mask stages orthogonal to flow solves
- [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) — flow-field regression tests
