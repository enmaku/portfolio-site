# SUBSTEP: hydrologyPaint

> **Label:** Paint river corridors  
> **Index:** 8 / 9 (final)  
> **Source:** `hydrologySubstepModules.js` → `hydrologyPaintSubstep`  
> **Target file (#356):** `substeps/hydrologyPaintSubstep.js`

---

## Purpose

Build physical river corridor mask from display centerline and channel width, smooth for display, set painted pipeline stage, and assemble final `RiverNetwork` contract for world document export.

---

## Input contract

Requires `HydrologyAfterSettle`:

| Key | Selector |
| --- | --- |
| `width`, `height` | world spine |
| `settledElevation` | `world.settledElevation` |
| `settledFlowDirection` | `world.settledFlowDirection` |
| `settledFlowAccumulation` | `world.settledFlowAccumulation` |
| `channelWidth` | `world.channelWidth` |
| `settledOcean` | `world.settledOcean` |
| `lakeMask` | `world.lakeMask` |
| `settledRiverGraph` | `world.settledRiverGraph` |

---

## Output contract (outputKeys)

```
riverMask.painted
riverNetwork
```

| Key | Type |
| --- | --- |
| `riverNetwork` | `RiverNetwork` |

Pipeline: `riverMask.painted` ← smoothed corridor mask.

---

## Algorithm sequence

1. `riverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(pipeline)`
2. `rawMask = buildPhysicalRiverCorridorMask(riverNetworkMask, …)` — progress 0–0.92
3. `paintedCorridorMask = smoothRiverCorridorMaskForDisplay(rawMask, width, height, 1)`
4. `setRiverMaskStage(pipeline, 'painted', paintedCorridorMask)`
5. `riverNetwork = assembleRiverNetwork({ … })`
6. `onProgress(1)`

---

## RiverNetwork assembly

```javascript
assembleRiverNetwork({
  simulationCenterline: resolveSimulationRiverNetworkMaskFromPipeline(riverMaskPipeline),
  centerline: riverNetworkMask,
  corridor: paintedCorridorMask,
  flowDirection: settledFlowDirection,
  flowAccumulation: settledFlowAccumulation,
  channelWidth,
  graph: settledRiverGraph,
  width, height,
})
```

| RiverNetwork field | Source |
| --- | --- |
| `simulationCenterline` | settled stage (never presentation) |
| `centerline` | presentation-or-settled |
| `corridor` | painted |
| `flow` | direction, accumulation, channelWidth |
| `graph` | settledRiverGraph |

---

## Primary algorithm imports

- `riverCorridorDisplay.js` — physical mask + smooth
- `riverNetwork.js` — `assembleRiverNetwork`
- `riverMaskLifecycle.js` — resolve helpers

---

## World document export mapping

Via `buildPipelineStateFromHydrologyWorld`:

- `simulationRiverMask` ← `riverNetwork.simulationCenterline`
- `riverNetworkMask` ← `riverNetwork.centerline`
- `riverCorridorMask` ← `riverNetwork.corridor`
- `riverGraph` ← `riverNetwork.graph`
- `flowDirection`, `channelWidth` from settled outputs

---

## Skip behavior

None — always runs.

---

## Flow solve

None.

---

## Tests

- Final substep in canonical order
- Painted mask length === width * height
- Progress reaches 1.0

---

## Migration notes

- Terminal stage type: `HydrologyAfterPaint`
- Input to extracted `buildPipelineStateFromHydrologyWorld.js` (#355.5)
