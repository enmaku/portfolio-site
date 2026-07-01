# SUBSTEP: hydrologyExtract

> **Label:** Extract river graph  
> **Index:** 5 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyExtractSubstep`  
> **Target file (#356):** `substeps/hydrologyExtractSubstep.js`

---

## Purpose

Recompute flow on incised elevation, extract channel centerline mask and width field, and build initial river graph from incised corridors.

---

## Input contract

Requires `HydrologyAfterIncise`:

| Key | Selector |
| --- | --- |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `settledElevation` | `world.settledElevation` |
| `lakeMask` | `world.lakeMask` |
| `rainfall` | `world.rainfall` |
| `effectiveRunoff` | `world.effectiveRunoff` |
| `meltContribution` | `world.meltContribution` |
| `baselineDrainage` | `baselineDrainageFromState(world.state)` |

---

## Output contract (outputKeys)

```
settledFlowDirection
settledFlowAccumulation
settledOcean
riverMask.settled
channelWidth
settledRiverGraph
```

| Key | Type |
| --- | --- |
| `settledFlowDirection` | `Int16Array` |
| `settledFlowAccumulation` | `Float32Array` |
| `settledOcean` | `boolean[]` |
| `channelWidth` | `Float32Array` |
| `settledRiverGraph` | `RiverGraph` |

Pipeline: `riverMask.settled` ← `extracted.channelMask`.

---

## Flow solve #2

Inside `extractRiverNetworkFromIncisedChannels` via `flowFieldSession`:

- Stage: `hydrologyExtract`
- Reason: `'extract-post-incision'`
- Elevation: `settledElevation`

---

## Pipeline read

```javascript
incisedCorridorMask: requireRiverMaskStage(riverMaskPipeline, 'incised')
```

---

## Primary algorithm imports

- `extractRiverNetworkFromIncisedChannels.js`

---

## Simulation centerline

`settled` mask stage is the **canonical simulation centerline** exported as `simulationRiverMask`. Never widened by later presentation stages.

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `settledFlowDirection`, `settledFlowAccumulation` | refine, settle, paint |
| `settledOcean` | refine, settle |
| `settledRiverGraph` | settle (rebuilt), paint |
| `channelWidth` | settle (rebuilt), paint |
| `riverMask.settled` | refine (required) |

---

## Skip behavior

None.

---

## Tests

- Flow solve log entry 2 of 3
- settled mask byte length === width * height

---

## Migration notes

- Introduces `settledFlow*` prefix distinct from route-stage `flowDirection`
