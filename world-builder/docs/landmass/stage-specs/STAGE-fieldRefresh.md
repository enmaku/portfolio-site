# Stage spec — `fieldRefresh`

> **Module ID:** `fieldRefresh`  
> **Label:** Seasonal climate annualization  
> **Order:** 4 of 6  
> **Target file:** `world-builder/core/stages/fieldRefreshStage.js`

---

## Purpose

When seasonal hydrology is enabled, annualize rainfall and temperature from seasonal simulation outputs and re-classify biomes with hydrology-aware rules (lake mask, river corridor, flow direction). When seasonal hydrology is disabled, pass through hydrology's authoritative `fields` and `biomes` unchanged.

---

## Implementation reference

| Path | Function | Module |
|------|----------|--------|
| Active | `deriveAnnualMeanClimate` | `hydrology/seasonalClimatology.js` |
| Active | `classifyBiomesWithHydrology` | `classifyBiomesFromFields.js` |
| Skip | identity | returns input fields/biomes |

**Current inline:** `runFieldRefreshStep` in `derivedGeographyPipeline.js` (lines ~647–677)

---

## Input contract

| Key | Type | Selector |
|-----|------|----------|
| `geographySeed`, `options`, `width`, `height` | params | state |
| `lakeMask` | `Uint8Array` | state |
| `riverNetworkMask` | `Uint8Array` | state |
| `fields` | `ScalarFields` | state (requires `drainage`) |
| `biomes` | `Uint8Array` | state |
| `riverCorridorMask` | `Uint8Array \| null` | state |
| `flowDirection` | `Int16Array \| null` | state |

**Preconditions:**

- `lastCompletedStep === 'hydrology'`
- `workingElevation`, `lakeMask`, `riverNetworkMask`, `fields.drainage`, `biomes` required

---

## Skip path

```javascript
shouldSkip: (state) => !state.options.enableSeasonalHydrology,
runSkipped(input) {
  return {
    fields: input.fields,
    biomes: input.biomes,
    lastCompletedStep: 'fieldRefresh',
  }
},
```

This is the **only** landmass stage with a production skip path today. Do not use skip for coast/resources or validation.

---

## Active path behavior

1. `deriveAnnualMeanClimate({ baseRainfall, baseTemperature, options })`  
2. Merge annual rainfall/temperature into `fields`  
3. `classifyBiomesWithHydrology(fields, width, height, { lakeMask, riverCorridorMask: riverCorridorMask ?? riverNetworkMask, flowDirection }, seaLevel, seed, biomeEdgeNoise)`

**Comment in source:** Hydrology exit is authoritative when seasonal hydrology is off; this stage only annualizes when seasonal is on.

---

## Output contract

| Key | Notes |
|-----|-------|
| `fields` | Annualized or pass-through |
| `biomes` | Re-classified or pass-through |
| `lastCompletedStep` | `'fieldRefresh'` |

---

## Contract test notes

`authoritativeBiomeRefreshAfterHydrology.test.js`:

- Documents seasonal-only responsibility for `fieldRefresh`
- Non-seasonal full pipeline invokes `classifyBiomesWithHydrology` from hydrology, not field refresh

---

## Module skeleton

```javascript
export const fieldRefreshStage = {
  id: 'fieldRefresh',
  label: 'Seasonal climate annualization',
  inputs: { /* selectors */ },
  outputKeys: ['fields', 'biomes', 'lastCompletedStep'],
  shouldSkip: (state) => !state.options.enableSeasonalHydrology,
  runSkipped(input) { /* pass-through */ },
  run(input) { /* annualize + classifyBiomesWithHydrology */ },
}
```

---

## Tests

| File | Coverage |
|------|----------|
| `authoritativeBiomeRefreshAfterHydrology.test.js` | Skip vs active responsibility |
| `seasonalClimatology.test.js` | Annualization math |
| `landmassPipelineStageContracts.test.js` | Picker preconditions |

---

## Related

- Previous: [STAGE-hydrology.md](./STAGE-hydrology.md)
- Next: [STAGE-coastAndResources.md](./STAGE-coastAndResources.md)
