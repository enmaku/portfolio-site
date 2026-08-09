# SUBSTEP: hydrologyFill

> **Label:** Fill lakes  
> **Index:** 0 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyFillSubstep`  
> **Target file (#356):** `substeps/hydrologyFillSubstep.js`

---

## Purpose

Derive ocean mask from eroded elevation, depression-fill the DEM, identify lakes, and compute initial lake metadata and basin catchment indices. First substep — no prior hydrology world fields required.

---

## Input contract

Selectors from `HydrologyAfterFill` input stage (`HydrologyWorldBase`):

| Key | Selector | Type |
| --- | --- | --- |
| `options` | `world.state.options` | `WorldGenerationOptions` |
| `width` | `world.width` | `number` |
| `height` | `world.height` | `number` |
| `erodedElevation` | `world.state.erodedElevation` | `Float32Array` |

---

## Output contract (outputKeys)

Exact keys from module metadata:

```
ocean
lakeMask
lakes
lakeMeta
hydrologyStats
filledElevation
spillOutlet
lakeIdByCell
catchmentCellsByLake
```

### Field types

| Key | Type | Notes |
| --- | --- | --- |
| `ocean` | `boolean[]` | via `flowFieldSession.deriveOceanMask` — not a full flow solve |
| `lakeMask` | `Uint8Array` | per-cell lake membership |
| `lakes` | `LakeRecord[]` | `{ id, area, endorheic, spillX?, spillY? }` |
| `lakeMeta` | `LakeMetaRecord[]` | surface/floor/spill elevations |
| `hydrologyStats` | `HydrologyPipelineStats` | breachCount, endorheicCount, endorheicFraction, lakeCount |
| `filledElevation` | `Float32Array` | depression-filled DEM |
| `spillOutlet` | `Int32Array` | per-cell spill outlet index |
| `lakeIdByCell` | `Int32Array` | lake id per cell |
| `catchmentCellsByLake` | basin map | from `basinCellsByLake` in fillLakes return |

---

## Shared dependencies

| Shared field | Usage |
| --- | --- |
| `flowFieldSession.deriveOceanMask` | ocean mask without D-infinity solve |

---

## Primary algorithm imports

- `fillLakes.js` — priority flood fill, breaching, lake records
- `flowField.js` — ocean derivation helper

### fillLakes options threaded

- `seaLevel`, `minLakeAreaScale`, `breachThreshold`
- `useDryFloorInitialLevel: options.enableSeasonalHydrology`

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `filledElevation` | hydrologySeasonal, hydrologyRoute |
| `lakeMask`, `lakes`, `lakeMeta` | seasonal, route, incise, extract, refine, settle, paint |
| `lakeIdByCell` | seasonal, route, settle |
| `ocean` | hydrologySeasonal |
| `catchmentCellsByLake` | seasonal (re-derived when seasonal enabled) |

---

## Skip behavior

None — always runs.

---

## River mask pipeline

No mask stages set.

---

## Tests

- `hydrologySubstepModules.test.js` — ocean array length, lakeMask typed array, hydrologyStats.lakeCount
- Composition test — fields absent before fill, present after

---

## Migration notes (#355 / #356)

- Output typedef: `HydrologyFillOutputs`
- Stage after run: `HydrologyAfterFill`
- First module in `HYDROLOGY_SUBSTEP_MODULES` registry
