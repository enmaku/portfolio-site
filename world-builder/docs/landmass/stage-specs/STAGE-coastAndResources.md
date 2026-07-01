# Stage spec — `coastAndResources`

> **Module ID:** `coastAndResources`  
> **Label:** Coast and resources  
> **Order:** 5 of 6  
> **Target file:** `world-builder/core/stages/coastAndResourcesStage.js`

---

## Purpose

Derive coast navigability and coastal nodes, place salt nodes, and generate arable, metals, and timber resource rasters/nodes from final elevation, fields, biomes, and river masks. No validation report yet.

---

## Implementation reference

| Output | Function | Module |
|--------|----------|--------|
| `coastNavigability` | `computeCoastNavigability` | `coast/computeCoastNavigability.js` |
| `coastalNodes` | `deriveCoastalNodes` | `coast/deriveCoastalNodes.js` |
| `saltNodes` | `placeSaltNodes` | `resources/placeSaltNodes.js` |
| `arableRaster` | `generateArableRaster` | `resources/generateArableRaster.js` |
| `metalsRaster` | `computeMetalsRaster` | `resources/computeMetalsRaster.js` |
| `metalNodes` | `placeMetalNodes` | `resources/placeMetalNodes.js` |
| `timberRaster` | `generateTimberProductivity` | `resources/generateTimberProductivity.js` |

**Current inline:** `runCoastAndResourcesStep` in `derivedGeographyPipeline.js` (lines ~682–758)

---

## Input contract

| Key | Type | Selector |
|-----|------|----------|
| `geographySeed`, `options`, `width`, `height` | params | state |
| `workingElevation` | `Float32Array` | state |
| `fields` | `ScalarFields` | state |
| `riverGraph` | `RiverGraph` | state |
| `biomes` | `Uint8Array` | state |
| `lakes` | `LakeRecord[]` | `state.lakes ?? []` |
| `riverCorridorMask` | `Uint8Array \| null` | state |
| `riverNetworkMask` | `Uint8Array \| null` | state |
| `channelWidth` | `Float32Array \| null` | state |

**Preconditions:** `lastCompletedStep === 'fieldRefresh'`; `workingElevation`, `fields`, `riverGraph`, `biomes` required.

---

## River mask fallback (must preserve)

Several calls use presentation masks with identical fallback chain as today:

```javascript
riverCorridorMask: input.riverCorridorMask ?? input.riverNetworkMask
```

Arable generation passes both corridor and network masks plus optional `channelWidth`. Metals raster uses `riverNetworkMask` only.

---

## Output contract

| Key | Notes |
|-----|-------|
| `coastNavigability` | Float raster for movement validation |
| `coastalNodes` | River mouth / harbor candidates |
| `saltNodes` | Placed up to `maxSaltNodes` |
| `arableRaster` | Productivity grid |
| `metalsRaster` | Deposit potential grid |
| `metalNodes` | Placed up to `maxMetalNodes` |
| `timberRaster` | Forest productivity |
| `lastCompletedStep` | `'coastAndResources'` |

---

## Resource options consumed

From `WorldGenerationOptions`:

- `seaLevel`
- `maxSaltNodes`, `maxMetalNodes`
- `arableMinimumProductivity`

Timber uses full `fields` + `biomes` + seed.

---

## World document assembly

`buildWorldDocumentFromPipelineState` attaches all resource fields when present. `cloneWorldDocument` deep-copies rasters and node arrays independently (tests in `derivedGeographyPipeline.test.js`).

---

## Module size

Largest stage body (~75 lines of calls). Target file ≤150 lines including imports and module wrapper.

---

## Tests

| File | Coverage |
|------|----------|
| `derivedGeographyPipeline.arable.test.js` | Arable in pipeline |
| `derivedGeographyPipeline.metals.test.js` | Metals in pipeline |
| `derivedGeographyPipeline.timber.test.js` | Timber in pipeline |
| `computeCoastNavigability.test.js` | Coast scalar |
| `placeSaltNodes.test.js`, `placeMetalNodes.test.js` | Node placement |

---

## Related

- Previous: [STAGE-fieldRefresh.md](./STAGE-fieldRefresh.md)
- Next: [STAGE-validation.md](./STAGE-validation.md)
