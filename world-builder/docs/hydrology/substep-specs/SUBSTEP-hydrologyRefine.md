# SUBSTEP: hydrologyRefine

> **Label:** Meander refine  
> **Index:** 6 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyRefineSubstep`  
> **Target file (#356):** `substeps/hydrologyRefineSubstep.js`

---

## Purpose

Optional presentation-stage geometry: corridor attraction and legacy meander refinement. Populates `presentation` river mask stage. May mutate `settledElevation` when full meander refine enabled.

---

## Input contract

Requires `HydrologyAfterExtract`:

| Key | Selector |
| --- | --- |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `geographySeed` | `world.state.geographySeed` |
| `settledElevation` | `world.settledElevation` |
| `settledOcean` | `world.settledOcean` |
| `settledFlowDirection` | `world.settledFlowDirection` |
| `settledFlowAccumulation` | `world.settledFlowAccumulation` |
| `lakeMask` | `world.lakeMask` |

---

## Output contract (outputKeys)

```
settledElevation
riverMask.presentation
```

Run return:

- `{}` when attraction-only (no elevation change)
- `{ settledElevation: refined.elevation }` when meander refine runs

Pipeline always sets `presentation` mask.

---

## Skip behavior

```javascript
shouldSkip: (world) =>
  !world.state.options.enableMeanderRefine &&
  !isCorridorAttractionEnabled(world.width, world.state.options.riverAttractionRadiusScale)
```

When skipped:

```javascript
runSkipped(_input, { riverMaskPipeline }) {
  applySkipRefineToPipeline(riverMaskPipeline)
  return {}
}
```

- Transition: `skipRefine` (`RIVER_MASK_SKIP_REFINE_TRANSITION`)
- Copies `settled` → `presentation`

---

## Run path (not skipped)

1. `requireRiverMaskStage(pipeline, 'settled')`
2. `applyPresentationStageCorridorAttraction` → attractedMask
3. If `!enableMeanderRefine`: presentation = attractedMask; return `{}`
4. Else `applyRefineStageMeanderPresentation` → union attracted + refined masks; optional elevation update

---

## Primary algorithm imports

- `riverNetworkLegacyMeanders.js`

---

## Flow solve

None.

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `riverMask.presentation` | settle (display resolve), paint |
| `settledElevation` | settle, paint |

`resolveDisplayRiverNetworkMaskFromPipeline` uses presentation-or-settled.

---

## Tests

- Skip path: presentation === settled (`riverMasksEqual`)
- Full refine: presentation may differ
- Hook receives `transition: 'skipRefine'` when skipped

---

## Migration notes

- Only substep with `shouldSkip` + `runSkipped` + `skipTransition`
- Presentation-only — must not affect simulation centerline
