# Stage spec — `physicalTerrainBaseline`

> **Module ID:** `physicalTerrainBaseline`  
> **Label:** Physical terrain baseline  
> **Order:** 1 of 6  
> **Target file:** `world-builder/core/stages/physicalTerrainBaselineStage.js`

---

## Purpose

Produce the initial physical terrain `WorldDocument`: elevation, climate scalar fields, drainage prior, biomes from fields-only classification, and generation metadata. No erosion, hydrology, or resources yet.

This stage establishes `baselineDoc`, which supplies `generatedAt` for all later world document assembly and preserves pre-erosion field references for hydrology fallbacks.

---

## Implementation reference

**Primary:** `generatePhysicalTerrainBaseline` (`core/generatePhysicalTerrainBaseline.js`)

**Current inline:** `runPhysicalTerrainBaselineStep` in `derivedGeographyPipeline.js` (lines ~555–568)

---

## Input contract

| Key | Type | Selector |
|-----|------|----------|
| `geographySeed` | `number` | `state.geographySeed` |
| `prevailingWindDegrees` | `number` | `state.prevailingWindDegrees` |
| `options` | `WorldGenerationOptions` | `state.options` |
| `width` | `number` | `state.width` |
| `height` | `number` | `state.height` |

**Preconditions:** none (`lastCompletedStep` may be `null`).

---

## Output contract

| Key | Type | Notes |
|-----|------|-------|
| `baselineDoc` | `WorldDocument` | Full baseline document from generator |
| `fields` | `ScalarFields` | `baselineDoc.fields` |
| `biomes` | `Uint8Array` | `baselineDoc.biomes` |
| `lastCompletedStep` | `'physicalTerrainBaseline'` | Gates erosion picker |

`assertLandmassStageOutputs` requires all keys non-null.

---

## Module skeleton

```javascript
export const physicalTerrainBaselineStage = {
  id: 'physicalTerrainBaseline',
  label: 'Physical terrain baseline',
  inputs: {
    geographySeed: (s) => s.geographySeed,
    prevailingWindDegrees: (s) => s.prevailingWindDegrees,
    options: (s) => s.options,
    width: (s) => s.width,
    height: (s) => s.height,
  },
  outputKeys: ['baselineDoc', 'fields', 'biomes', 'lastCompletedStep'],
  run(input) {
    const baselineDoc = generatePhysicalTerrainBaseline({ ...input })
    return {
      baselineDoc,
      fields: baselineDoc.fields,
      biomes: baselineDoc.biomes,
      lastCompletedStep: 'physicalTerrainBaseline',
    }
  },
}
```

---

## World document preview

When intermediate previews are enabled, `buildWorldDocumentFromPipelineState` after this step:

- Uses `state.fields` / `state.biomes`
- Sets `pipelineStage` to `PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE` (validation not complete)
- Omits hydrology/coast/resource optional fields

---

## Tests

| File | Coverage |
|------|----------|
| `generatePhysicalTerrainBaseline.test.js` | Generator determinism, field shapes |
| `derivedGeographyPipeline.test.js` | First step integration |
| `runLandmassPipeline.test.js` | Full pipeline includes baseline |

---

## Related

- [LANDMASS-STAGE-MODULES.md](../LANDMASS-STAGE-MODULES.md)
- Next stage: [STAGE-erosion.md](./STAGE-erosion.md)
