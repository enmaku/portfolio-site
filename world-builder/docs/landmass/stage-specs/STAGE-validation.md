# Stage spec — `validation`

> **Module ID:** `validation`  
> **Label:** Geography validation  
> **Order:** 6 of 6 (terminal)  
> **Target file:** `world-builder/core/stages/validationStage.js`

---

## Purpose

Assemble the river network structure for metrics, build the generation report (validation rows, hydrology stats, rejection signals), and mark the pipeline complete. Drives rejection sampling retry in the orchestrator when `generationReport.shouldReject` is true.

Completing this stage sets `lastCompletedStep === 'validation'`, which switches `buildWorldDocumentFromPipelineState` to `pipelineStage: PIPELINE_STAGE_DERIVED_GEOGRAPHY`.

---

## Implementation reference

| Step | Function | Module |
|------|----------|--------|
| River network | `assembleRiverNetworkFromFields` | `hydrology/riverNetwork.js` |
| Report | `buildGenerationReport` | `buildGenerationReport.js` |

**Current inline:** `runValidationStep` in `derivedGeographyPipeline.js` (lines ~764–800)

---

## Input contract

| Key | Type | Source |
|-----|------|--------|
| `prevailingWindDegrees`, `options`, `width`, `height` | params | state |
| `erosionStepCount` | `number` | state |
| `fields`, `biomes` | grids | state |
| `riverGraph` | graph | state |
| `coastalNodes` | nodes | state |
| `hydrologyStats`, `hydrologySubstepTimings` | report inputs | state (defaults for null stats) |
| `simulationRiverMask`, `riverNetworkMask`, `riverCorridorMask`, `lakeMask` | masks | state |
| `flowDirection`, `channelWidth` | optional | state |
| `arableRaster`, `saltNodes`, `metalNodes` | optional resources | state |

**Preconditions:** `lastCompletedStep === 'coastAndResources'`; `fields`, `biomes`, `riverGraph`, `coastalNodes` required.

---

## River network assembly

```javascript
assembleRiverNetworkFromFields({
  riverNetworkMask: input.simulationRiverMask ?? input.riverNetworkMask,
  riverCorridorMask: input.riverCorridorMask,
  flowDirection: input.flowDirection,
  flowAccumulation: input.fields.drainage,
  channelWidth: input.channelWidth ?? undefined,
  riverGraph: input.riverGraph,
  width, height,
})
```

**Simulation-first (#365):** prefer `simulationRiverMask` for logistics-facing network assembly (Hacks law, parallel strand, graph diagnostics). Presentation-only toggles must not change those simulation metrics.

**Sail overlay (#388, ADR 0010):** sailing validation checks (`navigableRiverQuota`, `coastMouth`, `coastConnectedNavigablePath`) derive from `core/sail/` using `elevation`, `lakeMask`, and `riverCorridorMask`. Meander refine may change sailing outcomes without changing `simulationRiverMask`.

---

## Generation report inputs

`buildGenerationReport` receives:

- Erosion and hydrology timing/stats  
- `lakeMask`, `riverCorridorMask` for **Sail overlay** metrics  
- `prevailingWindDegrees`, `validationOptions: input.options`  
- Optional resource outputs for resource validation slice  
- Default `hydrologyStats` when null:

```javascript
{ breachCount: 0, endorheicCount: 0, endorheicFraction: 0, lakeCount: 0 }
```

---

## Output contract

| Key | Notes |
|-----|-------|
| `generationReport` | Full report with `shouldReject`, validation rows, signals |
| `lastCompletedStep` | `'validation'` |

---

## Orchestrator interaction

After this stage:

- Success path: if `!shouldReject`, runner returns cloned world document  
- Reject path: runner increments seed and retries up to `maxValidationRetries`  
- Exhausted path: returns last document even if `shouldReject` (status `exhausted`)

`shouldAttachLandmassStepPreview('validation', options)` is always true even when intermediate previews disabled — validation preview is the default final map update.

---

## Module skeleton

```javascript
export const validationStage = {
  id: 'validation',
  label: 'Geography validation',
  inputs: { /* selectors from pickValidationStageInput */ },
  outputKeys: ['generationReport', 'lastCompletedStep'],
  run(input) {
    const riverNetwork = assembleRiverNetworkFromFields({ ... })
    const generationReport = buildGenerationReport({ ... })
    return { generationReport, lastCompletedStep: 'validation' }
  },
}
```

---

## Tests

| File | Coverage |
|------|----------|
| `buildGenerationReport.test.js` | Report structure |
| `runGeographyValidationChecks.test.js` | Validation slices |
| `shouldRejectGeographyCandidate.test.js` | Rejection policy |
| `derivedGeographyPipeline.test.js` | Validation preview attachment |
| `runLandmassPipeline.test.js` | Retry / exhausted |

---

## Related

- Previous: [STAGE-coastAndResources.md](./STAGE-coastAndResources.md)
- [LANDMASS-STAGE-MODULES.md](../../LANDMASS-STAGE-MODULES.md)
- Simulation consumer: #365
