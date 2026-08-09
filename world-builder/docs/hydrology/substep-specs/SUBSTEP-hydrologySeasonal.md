# SUBSTEP: hydrologySeasonal

> **Label:** Seasonal hydrology  
> **Index:** 2 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologySeasonalSubstep`  
> **Target file (#356):** `substeps/hydrologySeasonalSubstep.js`

---

## Purpose

Compute cell-effective runoff for routing. When seasonal hydrology is enabled, simulate multi-year lake level dynamics, overflow, and bank crumble — updating lake records and filled elevation.

---

## Input contract

Requires `HydrologyAfterClimate` — 18 selector keys:

| Key | Source |
| --- | --- |
| `geographySeed` | `world.state.geographySeed` |
| `prevailingWindDegrees` | `world.state.prevailingWindDegrees` |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `erodedElevation` | `world.state.erodedElevation` |
| `baselineDrainage` | `baselineDrainageFromState(world.state)` |
| `filledElevation` | `world.filledElevation` |
| `lakeMask`, `lakes`, `lakeMeta`, `lakeIdByCell` | fill outputs |
| `temperature`, `rainfall`, `snowCapMask`, `meltContribution` | climate outputs |
| `ocean` | fill output |
| `hydrologyStats` | fill output |

---

## Output contract (outputKeys)

```
effectiveRunoff
overflowLakeIds
filledElevation
lakeMeta
lakes
catchmentCellsByLake
hydrologyStats
```

### Non-seasonal branch (`!enableSeasonalHydrology`)

Returns only:

```javascript
{
  effectiveRunoff: computeCellRunoff({ rainfall, meltContribution, soilDrainage, ... }),
  overflowLakeIds: new Set(),
}
```

Lake fields unchanged on world (retain fill-stage values).

### Seasonal branch

Full return from `simulateSeasonalHydrology` plus `deriveBasinCatchments`:

- Updates `filledElevation`, `lakeMeta`, `lakes`
- Adds `overflowLakeIds`, extended `hydrologyStats` (overflowLakeCount, seasonalYearCount, meanLakeLevelDelta, bankCrumbleCount)

---

## Primary algorithm imports

- `computeCellRunoff.js`
- `deriveBasinCatchments.js`
- `simulateSeasonalHydrology.js`

---

## Flow solve impact

Seasonal path mutates `filledElevation` before route solve #1. Still exactly three full flow solves total (see FLOW-FIELD-INVARIANTS.md).

---

## Skip behavior

None — always runs (branch inside `run`).

---

## River mask pipeline

No mask stages set.

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `effectiveRunoff` | route, extract, settle |
| `overflowLakeIds` | route (sketch mask) |
| updated lake fields | settle |

---

## Tests

Seasonal enabled/disabled paths in `simulateSeasonalHydrology.test.js` and pipeline integration tests.

---

## Migration notes

- Most input-heavy substep — 18 selectors
- Output partial differs by options branch; typed as union or optional fields on `HydrologySeasonalOutputs`
