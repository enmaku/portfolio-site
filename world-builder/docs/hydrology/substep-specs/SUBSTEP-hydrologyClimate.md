# SUBSTEP: hydrologyClimate

> **Label:** Climate refresh  
> **Index:** 1 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyClimateSubstep`  
> **Target file (#356):** `substeps/hydrologyClimateSubstep.js`

---

## Purpose

Refresh temperature and rainfall fields on the post-erosion / post-fill elevation surface, derive snow cap mask, and compute melt contribution (or zero placeholder when seasonal hydrology will handle melt later).

---

## Input contract

Requires `HydrologyAfterFill`:

| Key | Selector | Type |
| --- | --- | --- |
| `geographySeed` | `world.state.geographySeed` | `number` |
| `prevailingWindDegrees` | `world.state.prevailingWindDegrees` | `number` |
| `options` | `world.state.options` | `WorldGenerationOptions` |
| `width` | `world.width` | `number` |
| `height` | `world.height` | `number` |
| `erodedElevation` | `world.state.erodedElevation` | `Float32Array` |
| `baselineDrainage` | `baselineDrainageFromState(world.state)` | `Float32Array \| null` |

`baselineDrainageFromState` reads `state.baselineDoc?.fields.drainage ?? state.fields?.drainage`.

---

## Output contract (outputKeys)

```
temperature
rainfall
snowCapMask
meltContribution
```

| Key | Type | Notes |
| --- | --- | --- |
| `temperature` | `Float32Array` | from `refreshFieldsAfterErosion` |
| `rainfall` | `Float32Array` | from `refreshFieldsAfterErosion` |
| `snowCapMask` | `Uint8Array` | from `deriveSnowCapMask` |
| `meltContribution` | `Float32Array` | zeroed when `enableSeasonalHydrology`; else `deriveSnowMeltContribution` |

---

## Primary algorithm imports

- `refreshFieldsAfterErosion.js`
- `deriveSnowCapMask.js` — `deriveSnowCapMask`, `deriveSnowMeltContribution`
- `baselineDrainageFromState.js` (#356)

---

## Branch: seasonal flag

```javascript
const meltContribution = options.enableSeasonalHydrology
  ? new Float32Array(width * height)
  : deriveSnowMeltContribution({ ... })
```

When seasonal enabled, melt is deferred to `hydrologySeasonal` via `simulateSeasonalHydrology`.

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `temperature`, `rainfall`, `snowCapMask` | hydrologySeasonal |
| `rainfall` | hydrologyRoute, hydrologyExtract, hydrologySettle |
| `meltContribution` | hydrologyRoute, hydrologyExtract (sketch mask weighting) |

---

## Skip behavior

None — always runs.

---

## Flow / mask side effects

None — no flow solve, no river mask mutation.

---

## Tests

Climate fields are Float32Array with length `width * height` after composition through climate substep.

---

## Migration notes

- Input stage: `HydrologyAfterFill`
- Output stage: `HydrologyAfterClimate`
- Extract helper `baselineDrainageFromState` shared with route/extract/settle
