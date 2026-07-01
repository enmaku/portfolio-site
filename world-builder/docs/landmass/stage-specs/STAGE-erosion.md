# Stage spec — `erosion`

> **Module ID:** `erosion`  
> **Label:** Erosion  
> **Order:** 2 of 6  
> **Target file:** `world-builder/core/stages/erosionStage.js`

---

## Purpose

Apply iterative hydraulic erosion to baseline elevation, refresh climate scalars that depend on elevation (temperature, rainfall, salinity, etc.), and re-classify biomes on the eroded surface. Sets `workingElevation` used by hydrology and coast stages.

---

## Implementation reference

| Step | Function | Module |
|------|----------|--------|
| Erosion | `applyErosion` | `core/erosion/applyErosion.js` |
| Climate refresh | `refreshClimateScalarsAfterElevationMutation` | `core/fields/refreshClimateScalarsAfterElevationMutation.js` |
| Biomes | `classifyBiomesFromFields` | `core/classifyBiomesFromFields.js` |

**Current inline:** `runErosionStep` in `derivedGeographyPipeline.js` (lines ~574–607)

---

## Input contract

| Key | Type | Selector |
|-----|------|----------|
| `geographySeed` | `number` | state |
| `prevailingWindDegrees` | `number` | state |
| `options` | `WorldGenerationOptions` | state |
| `width`, `height` | `number` | state |
| `baselineDoc` | `WorldDocument` | `state.baselineDoc` |

**Preconditions:**

- `state.lastCompletedStep === 'physicalTerrainBaseline'`
- `state.baselineDoc` present

Picker errors: `"physicalTerrainBaseline required before erosion"`, `"physicalTerrainBaseline baselineDoc required before erosion"`.

---

## Output contract

| Key | Type | Notes |
|-----|------|-------|
| `erodedElevation` | `Float32Array` | Post-erosion heights |
| `erosionSnapshots` | `Float32Array[]` | Per-iteration snapshots for report/debug |
| `erosionStepCount` | `number` | Passed to validation report |
| `workingElevation` | `Float32Array` | Same as eroded elevation |
| `fields` | `ScalarFields` | Refreshed after elevation mutation |
| `biomes` | `Uint8Array` | Re-classified from preview fields |
| `lastCompletedStep` | `'erosion'` | Gates hydrology |

---

## Erosion inputs from baseline

`applyErosion` reads:

- `elevation: input.baselineDoc.fields.elevation`
- `drainage` is **not** re-run here; hydrology rebuilds drainage from flow

Climate refresh preserves `drainage` from baseline while replacing elevation-driven scalars:

```javascript
refreshClimateScalarsAfterElevationMutation({
  elevation: erodedElevation,
  drainage: input.baselineDoc.fields.drainage,
  ...
})
```

---

## Preview semantics

Erosion step previews must carry fresh salinity (`elevationMutationClimateRefresh.test.js`). `buildWorldDocumentFromPipelineState` uses `state.fields` when set.

---

## Module notes

- No `PipelineStepOptions` — erosion is synchronous
- Does not mutate `baselineDoc` in place; eroded elevation is separate array
- Biome edge noise uses `options.biomeEdgeNoiseStrength` and `geographySeed`

---

## Tests

| File | Coverage |
|------|----------|
| `applyErosion.test.js` | Erosion algorithm |
| `elevationMutationClimateRefresh.test.js` | Salinity in previews |
| `derivedGeographyPipeline.test.js` | Step wiring |

---

## Related

- Previous: [STAGE-physicalTerrainBaseline.md](./STAGE-physicalTerrainBaseline.md)
- Next: [STAGE-hydrology.md](./STAGE-hydrology.md)
