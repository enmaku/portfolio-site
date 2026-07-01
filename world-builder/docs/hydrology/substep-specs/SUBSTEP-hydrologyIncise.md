# SUBSTEP: hydrologyIncise

> **Label:** Incise channels  
> **Index:** 4 / 9  
> **Source:** `hydrologySubstepModules.js` → `hydrologyInciseSubstep`  
> **Target file (#356):** `substeps/hydrologyInciseSubstep.js`

---

## Purpose

Stream-power carve temporary rivers along sketch centerlines, producing incised elevation and an incised corridor mask unioned with elevation-difference corridor detection.

---

## Input contract

Requires `HydrologyAfterRoute`:

| Key | Selector |
| --- | --- |
| `options` | `world.state.options` |
| `width`, `height` | world spine |
| `geographySeed` | `world.state.geographySeed` |
| `filledElevation` | `world.filledElevation` |
| `lakeMask` | `world.lakeMask` |
| `lakeOcean` | `world.lakeOcean` |
| `flowDirection` | `world.flowDirection` |
| `flowAccumulation` | `world.flowAccumulation` |

---

## Output contract (outputKeys)

```
settledElevation
riverMask.incised
```

| Key | Type | Notes |
| --- | --- | --- |
| `settledElevation` | `Float32Array` | carved.elevation from stream power |

Pipeline: `riverMask.incised` ← `unionCorridorMasks(carved.corridorMask, deriveIncisedCorridorMask(...))`.

---

## Pipeline read

```javascript
channelSeedMask: requireRiverMaskStage(riverMaskPipeline, 'sketch')
```

Throws if sketch missing.

---

## Primary algorithm imports

- `seededTemporaryRiverCarve.js` — `carveTemporaryRivers`
- `extractRiverNetworkFromIncisedChannels.js` — `unionCorridorMasks`, `deriveIncisedCorridorMask`

### Carve parameters from options

- `incisionDepth: erosionChannelWear * 1.5`
- `inciseIterations`, `streamPowerK/M/N`, `channelInitiationThreshold`
- forwards `onProgress` from shared

---

## Flow solve

None in this substep — extract performs solve #2 on `settledElevation`.

---

## Skip behavior

None.

---

## Downstream consumers

| Field | Read by |
| --- | --- |
| `settledElevation` | extract, refine, settle, paint |
| `riverMask.incised` | extract (required) |

---

## Elevation naming shift

From this substep forward, primary working DEM is `settledElevation` (post-incision). `filledElevation` remains on world but is not the extract solve input.

---

## Tests

Incised mask requires prior sketch. Progress callback invoked during carve.

---

## Migration notes

- First substep mutating `settledElevation`
- Long-running — uses `onProgress` shared hook
