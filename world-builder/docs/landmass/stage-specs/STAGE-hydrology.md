# Stage spec — `hydrology`

> **Module ID:** `hydrology`  
> **Label:** Hydrology  
> **Order:** 3 of 6  
> **Target file:** `world-builder/core/stages/hydrologyStage.js`

---

## Purpose

Run the full hydrology substep pipeline: lake fill, flow routing, river incision/extraction/refine/settle/paint, optional seasonal simulation, and authoritative field/biome updates when seasonal mode is off.

This landmass stage is a **thin delegate** to `runHydrologySubsteps` — nine substep modules remain in `core/hydrology/`.

---

## Implementation reference

| Step | Function | Module |
|------|----------|--------|
| State bridge | `buildPipelineStateForHydrologySubsteps` | `landmassPipelineStageContracts.js` |
| Substep runner | `runHydrologySubsteps` | `hydrology/hydrologySubsteps.js` |

**Current inline:** `runHydrologyStep` in `derivedGeographyPipeline.js` (lines ~613–639)

---

## Input contract

| Key | Type | Selector |
|-----|------|----------|
| `geographySeed`, `prevailingWindDegrees`, `options`, `width`, `height` | params | state |
| `baselineDoc` | `WorldDocument` | `state.baselineDoc` |
| `erodedElevation` | `Float32Array` | `state.erodedElevation` |
| `fields` | `ScalarFields \| null` | `state.fields` |

**Preconditions:**

- `lastCompletedStep === 'erosion'`
- `baselineDoc` and `erodedElevation` required

---

## Output contract

| Key | Role |
|-----|------|
| `lakeMask`, `lakes`, `lakeMeta`, `lakeIdByCell` | Lake system |
| `hydrologyStats` | Breach/endorheic/lake counts |
| `workingElevation` | Post-fill/post-carve working surface |
| `riverGraph` | Simulation river graph |
| `simulationRiverMask` | Logistics-facing centerline mask |
| `riverNetworkMask`, `riverCorridorMask` | Presentation masks |
| `channelWidth`, `flowDirection` | River geometry |
| `fields`, `biomes` | Updated scalars and classification |
| `hydrologySubstepTimings` | Report timings array |
| `lastCompletedStep` | `'hydrology'` |

All keys required non-null by `assertLandmassStageOutputs`.

---

## PipelineStepOptions (orchestrator → hydrology)

Only this landmass stage receives substep callbacks from the orchestrator:

```javascript
{
  onSubstepStart,
  onSubstepProgress,
  onSubstepComplete,
  onSubstepPrepare,
  shouldCancel: () => Boolean(callbacks.shouldCancel?.()),
}
```

Wired in `createHydrologyStepOptions` inside `derivedGeographyPipeline.js` (moves to `landmassPipelineRunner.js` in #361).

---

## Substep order (reference)

From `HYDROLOGY_SUBSTEP_MODULES`:

1. hydrologyFill  
2. hydrologyClimate  
3. hydrologySeasonal (skippable)  
4. hydrologyRoute  
5. hydrologyIncise  
6. hydrologyExtract  
7. hydrologyRefine (skippable — `skipRefine` transition)  
8. hydrologySettle  
9. hydrologyPaint  

River mask lifecycle: sketch → incised → settled → presentation → painted.

---

## Authoritative biomes

When `enableSeasonalHydrology` is **false**, hydrology exit owns final `fields` and `biomes`. `fieldRefresh` pass-through documents this (`authoritativeBiomeRefreshAfterHydrology.test.js`).

When seasonal mode is **true**, hydrology runs seasonal simulation; `fieldRefresh` annualizes climate and re-classifies with hydrology masks.

---

## Module skeleton

```javascript
export const hydrologyStage = {
  id: 'hydrology',
  label: 'Hydrology',
  inputs: { /* see input contract */ },
  outputKeys: [ /* all hydrology outputs + lastCompletedStep */ ],
  run(input, options = {}) {
    const hydrologyState = buildPipelineStateForHydrologySubsteps(input)
    const { state: nextState, timings } = runHydrologySubsteps(hydrologyState, options)
    return { /* map nextState fields */, hydrologySubstepTimings: timings, lastCompletedStep: 'hydrology' }
  },
}
```

Target file ≤80 lines.

---

## Tests

| File | Coverage |
|------|----------|
| `hydrologySubsteps.test.js` | Substep runner |
| `hydrologySubstepContracts.test.js` | Derived contracts |
| `derivedGeographyPipeline.test.js` | lakeMeta in world doc |
| `hydrologyRiverPathfindingSeamContract.test.js` | simulation mask seam |

---

## Related

- Previous: [STAGE-erosion.md](./STAGE-erosion.md)
- Next: [STAGE-fieldRefresh.md](./STAGE-fieldRefresh.md)
- Hydrology typing: HYDROLOGY-TYPED-STAGES.md (planned)
