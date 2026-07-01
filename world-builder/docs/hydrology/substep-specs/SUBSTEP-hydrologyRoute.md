# SUBSTEP: hydrologyRoute

> **Label:** Route runoff  
> **Index:** 3 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyRouteSubstep`  
> **Target file (#356):** `substeps/hydrologyRouteSubstep.js`

---

## Purpose

First full D-infinity flow solve on filled elevation with effective runoff. Build initial river network sketch mask from flow accumulation thresholds.

---

## Input contract

Requires `HydrologyAfterSeasonal`:

| Key | Selector |
| --- | --- |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `filledElevation` | `world.filledElevation` |
| `lakeMask` | `world.lakeMask` |
| `rainfall` | `world.rainfall` |
| `effectiveRunoff` | `world.effectiveRunoff` |
| `meltContribution` | `world.meltContribution` |
| `baselineDrainage` | `baselineDrainageFromState(world.state)` |
| `overflowLakeIds` | `world.overflowLakeIds` |
| `lakeIdByCell` | `world.lakeIdByCell` |

---

## Output contract (outputKeys)

```
flowDirection
flowAccumulation
lakeOcean
riverMask.sketch
```

Data return object:

| Key | Type |
| --- | --- |
| `flowDirection` | `Int16Array` |
| `flowAccumulation` | `Float32Array` |
| `lakeOcean` | `boolean[]` |

Contract key `riverMask.sketch` → `setRiverMaskStage(pipeline, 'sketch', sketchRiverNetworkMask)`.

---

## Flow solve #1

```javascript
flowFieldSession.recomputeFullFlow({
  reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
  stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
  elevation: filledElevation,
  cellRunoff: effectiveRunoff,
  soilDrainage: baselineDrainage,
  // ...
})
```

Reason: `'route-filled-dem'`.

---

## Sketch mask algorithm

`buildRiverNetworkMask` with:

- flow accumulation + direction from solve
- `ocean: lakeOcean`, `lakeMask`
- `meltContribution`, `navigableFlowCutoffScale`
- optional `overflowLakeIds`, `lakeIdByCell`

---

## Shared dependencies

| Shared | Usage |
| --- | --- |
| `flowFieldSession` | recomputeFullFlow |
| `riverMaskPipeline` | set sketch stage |

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `flowDirection`, `flowAccumulation` | hydrologyIncise (read only) |
| `lakeOcean` | hydrologyIncise |
| `riverMask.sketch` | hydrologyIncise (required) |

Route flow fields superseded by settled flow after extract — not used by settle directly.

---

## Skip behavior

None.

---

## Tests

- Flow solve log entry 1 of 3
- Sketch mask populated after route in composition tests

---

## Migration notes

- `HydrologyRouteOutputs` includes flow triple; mask on pipeline only
