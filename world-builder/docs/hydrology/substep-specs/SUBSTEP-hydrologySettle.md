# SUBSTEP: hydrologySettle

> **Label:** Settle drainage  
> **Index:** 7 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologySettleSubstep`  
> **Target file (#356):** `substeps/hydrologySettleSubstep.js`

---

## Purpose

Equilibrate lake levels on carved terrain, recompute flow (solve #3), derive drainage field, rebuild channel width and river graph from display centerline, and sync lake surfaces from metadata.

---

## Input contract

Requires `HydrologyAfterRefine`:

| Key | Selector |
| --- | --- |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `settledElevation` | `world.settledElevation` |
| `lakeMask`, `lakes`, `lakeMeta` | lake fields |
| `settledOcean` | `world.settledOcean` |
| `rainfall` | `world.rainfall` |
| `effectiveRunoff` | `world.effectiveRunoff` |
| `lakeIdByCell` | `world.lakeIdByCell` |
| `baselineDrainage` | `baselineDrainageFromState(world.state)` |

---

## Output contract (outputKeys)

```
settledElevation
lakes
lakeMeta
spillOutlet
settledFlowDirection
settledFlowAccumulation
settledOcean
settledDrainage
channelWidth
settledRiverGraph
```

Ten data keys — full list in HYDROLOGY-TYPED-STAGES.md.

---

## Flow solve #3

After `settleLakeEquilibrium`:

```javascript
flowFieldSession.recomputeFullFlow({
  reason: FLOW_RECOMPUTE_REASONS.hydrologySettle,
  stage: FLOW_RECOMPUTE_STAGES.hydrologySettle,
  elevation: lakeSettled.elevation,
  // ...
})
```

Reason: `'settle-post-lake-equilibrium'`.

---

## Display mask resolution

```javascript
const displayRiverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(riverMaskPipeline)
```

Used for `buildChannelWidthField` and `buildRiverGraph` — presentation-or-settled centerline.

---

## Lake surface coherence

When `lakeIdByCell`, `lakeMeta`, `lakeMask` present:

```javascript
applyLakeSurfacesFromMeta(lakeSettled.elevation, lakeIdByCell, lakeMeta, lakeMask, width, height)
```

Mutates elevation buffer in place before return.

---

## Primary algorithm imports

- `settleLakeEquilibrium.js`
- `deriveDrainageFromFlow.js`
- `buildRiverGraph.js`
- `extractRiverNetworkFromIncisedChannels.js` — `buildChannelWidthField`
- `lakeDisplayCoherence.js` — `applyLakeSurfacesFromMeta`

---

## River mask pipeline

Does not set new stages — reads presentation/settled for width/graph.

---

## Downstream consumers

All outputs consumed by `hydrologyPaint` and `buildPipelineStateFromHydrologyWorld`.

---

## Skip behavior

None.

---

## Tests

- Third uncached solve log entry
- `settledDrainage` derived from post-settle accumulation
- Lake surface/meta coherence tests

---

## Migration notes

- Largest data output aside from paint
- Rebuilds graph/width even if extract produced earlier versions
