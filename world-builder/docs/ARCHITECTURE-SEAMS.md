# Architecture seams — World Builder (ADR-0009)

This document defines the **seam boundaries** for the World Builder **landmass pipeline** and map display stack. It implements the package layout decided in [ADR-0009](../../docs/adr/0009-world-builder-map-display-stack.md): generators and editors mutate **world document** state; renderers read state and never mutate it.

Domain vocabulary: [`world-builder/CONTEXT.md`](../CONTEXT.md). Phase 5 enforcement: [`PHASE-5-MASTER-PLAN.md`](./PHASE-5-MASTER-PLAN.md), [`ADR-0009-COMPLIANCE-CHECKLIST.md`](./ADR-0009-COMPLIANCE-CHECKLIST.md).

---

## Part 1 — ADR-0009 summary

ADR-0009 separates four layers:

```
settings → generators → world document → renderer
UI → editors → world document → renderer
```

| Package / path | Responsibility | May import |
| --- | --- | --- |
| `world-builder/core/` | **Landmass pipeline**, **scalar fields**, hydrology, **validation checks**, **world document** assembly — pure JS, no DOM | Other `core/`, shared types |
| `world-builder/renderer/` | Map viewport, layer compositing, raster upload — reads **world document** + overlay config | `core/types.js`, palette helpers — **not** pipeline runners |
| `world-builder/worker/` | Off-main-thread **landmass pipeline** execution | `core/derivedGeographyPipeline.js`, worker protocol |
| `src/composables/` | Page controller, overlay owner, generation composables | `world-builder/*` public entry points — lazy-load renderer |
| `src/pages/projects/WorldBuilderPage.vue` | Quasar layout, thin bindings | Vue, Quasar, composables, page model only |

**Primary viewport:** PixiJS 8 + pixi-viewport, mounted imperatively from `world-builder/renderer/createWorldBuilderMapViewport.js`.

**Simulation stays CPU-side and deterministic** (same **geography seed** → same **scalar fields**). Renderer replays pipeline snapshots for animation; it does not re-run erosion or hydrology.

---

## Part 2 — Seam 1: settings → generation → world document

### Data flow

```
Pinia settings store (src/stores/worldBuilderSettings.js)
  → useWorldBuilderPageController (src/composables/useWorldBuilderPageController.js)
    → useWorldBuilderGeneration (src/composables/useWorldBuilderGeneration.js)
      → worldBuilderGenerationOrchestrator.js (progress, cancel, stale-run)
        → runDerivedGeographyInWorker.js
          → worker/derivedGeography.worker.js
            → core/derivedGeographyPipeline.js (landmass pipeline)
              → buildWorldDocumentFromPipelineState.js
                → WorldDocument (core/types.js)
```

### Owner modules

| Module | Role |
| --- | --- |
| `src/stores/worldBuilderSettings.js` | Persists **geography seed**, prevailing wind, generation options, overlay display settings |
| `src/composables/useWorldBuilderGeneration.js` | Wires worker callbacks to orchestrator; applies step previews per `worldBuilderGenerationPolicy.js` |
| `world-builder/worldBuilderGenerationOrchestrator.js` | Run IDs, cancel, progress reducers, hydrology substep progress |
| `world-builder/worldBuilderGenerationPolicy.js` | Pure functions: `shouldApplyStepPreviewToMap`, progress percent |
| `world-builder/runDerivedGeographyInWorker.js` | Main-thread worker lifecycle |
| `world-builder/worker/derivedGeographyWorkerProtocol.js` | Message shapes: start, cancel, step preview, terminal |
| `world-builder/core/derivedGeographyPipeline.js` | **Landmass pipeline** orchestration (being decomposed in #361) |
| `world-builder/core/landmassPipelineStageModules.js` | Ordered stage registry (#359) |
| `world-builder/core/buildWorldDocumentFromPipelineState.js` | Assembles serializable **world document** (#361) |

### Contract rules

1. Generation composables **never** import Pixi, `createWorldBuilderMapViewport`, or canvas builders.
2. Worker and orchestrator **never** import from `world-builder/renderer/**`.
3. Step previews that reach the map go through the page controller's map lifecycle (`worldBuilderGenerationMapLifecycle.js`), not by generator calling into Pixi.
4. `useWorldBuilderGeneration` tests live in `world-builder/worldBuilderGenerationSeamContract.test.js`.

### Verification grep

```bash
rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ src/composables/useWorldBuilderGeneration.js --glob '*.js' | rg -v test
# Expect 0 production hits
```

---

## Part 3 — Seam 2: landmass pipeline → world document fields

### Pipeline order (canonical)

From [`CONTEXT.md`](../CONTEXT.md) **Landmass pipeline** section:

1. **Scalar fields** — `core/fields/` (elevation, temperature, rainfall, drainage, salinity)
2. **Derived geography** — erosion, hydrology, biomes, lakes, **strategic resource** nodes
3. **Logistics pass** inputs — movement cost, visibility (partial in v1)
4. **Rejection sampling** — **validation checks** via `core/validation/`
5. Handoff fields for downstream epics (not Phase 5 scope)

### Stage dispatch

| Stage id | Primary module(s) |
| --- | --- |
| `physicalTerrainBaseline` | `core/generatePhysicalTerrainBaseline.js`, `core/stages/physicalTerrainBaselineStage.js` |
| `erosion` | `core/erosion/applyErosion.js`, `core/stages/erosionStage.js` |
| `hydrology` | `core/hydrology/hydrologySubsteps.js`, substeps under `core/hydrology/substeps/` |
| `fieldRefresh` | `core/fields/refreshFieldsAfterErosion.js` |
| `coastAndResources` | `core/coast/`, `core/resources/` |
| `validation` | `core/validation/runGeographyValidationChecks.js` |

Contracts derive from stage modules (`core/landmassPipelineStageContracts.js`) — not parallel hand-maintained tables (#360).

### World document export

`core/types.js` defines `WorldDocument` fields consumed by renderer and validation:

- **Scalar field** rasters under `fields`
- `biomes` (simulation classification) vs `displayBiomes` (presentation)
- Hydrology masks — see [`SIMULATION-VS-PRESENTATION-HYDROLOGY.md`](./SIMULATION-VS-PRESENTATION-HYDROLOGY.md)
- Resource rasters and node lists
- `geographySeed`, generation metadata

`buildWorldDocumentFromPipelineState.js` is the single assembly seam from pipeline state to document.

---

## Part 4 — Seam 3: simulation vs presentation hydrology

Hydrology emits both **simulation hydrology** (logistics-facing) and **presentation hydrology** (map display). See dedicated doc for field map.

| Field | Stage source | Consumers |
| --- | --- | --- |
| `simulationRiverMask` | `RiverMaskPipeline.settled` | Validation, generation report, future **movement cost** / **trade route** work |
| `riverNetworkMask` | presentation-or-settled centerline | Renderer river overlay, `assembleRiverNetwork` display path |
| `riverCorridorMask` | `RiverMaskPipeline.painted` | Biome refresh (`classifyBiomesFromFields.js`), corridor tint |

Lifecycle module: `core/hydrology/riverMaskLifecycle.js`.

**Rule:** Presentation-only options (`enableMeanderRefine`, `riverAttractionRadiusScale`) must not mutate `simulationRiverMask` byte arrays (#358, #365).

---

## Part 5 — Seam 4: overlay owner → viewport

### Data flow

```
useWorldBuilderOverlayState (src/composables/useWorldBuilderOverlayState.js)
  → resourceOverlayState.js (visibility map, display settings)
    → worldBuilderOverlayControls.js (toggle handlers)
      → page controller syncOverlayRenderCache(viewport)
        → createWorldBuilderMapViewport.updateWorldDocument / overlay commit
          → mapLayerRefresh.js (per MapLayerId handlers)
            → diffResourceOverlayMapLayers.js, diffWorldDocumentMapLayers.js
```

### Owner vs renderer

| Concern | Owner | Renderer |
| --- | --- | --- |
| Checkbox / persisted settings | `useWorldBuilderOverlayState`, Pinia store | — |
| Which layers are visible | `resourceOverlayState.js` | Applies visibility to Pixi sprites |
| When to rebuild raster | Overlay owner commits state | `resourceRasterOverlayRefresh.js` |
| When to redraw vectors | Overlay owner commits state | Per-family layers: `coastalNodes`, `metalNodes`, `saltNodes` (#362) |
| Arable minimum productivity threshold | Settings store → overlay state | `buildArableOverlayCanvas` path |

### MapLayerId locality (#362, #363)

`world-builder/renderer/mapLayerRefresh.js` registers handlers per layer id. Toggling one **strategic resource** overlay must not invoke unrelated draw handlers.

Deprecated: monolithic `vectorOverlays` object that refreshed all markers together.

### Verification tests

- `world-builder/resourceOverlayStateSeamContract.test.js` — owner-only viewport mutation path
- `world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js` — raster locality
- `world-builder/renderer/createWorldBuilderMapViewport.overlayVisibility.test.js`
- Post-#362: per-layer draw spies in overlay sync tests

---

## Part 6 — Seam 5: world document → renderer (pure view)

### Entry point

`world-builder/renderer/createWorldBuilderMapViewport.js`:

- Builds terrain from `displayBiomes` via `buildLandTerrainRgba.js` — **not** from simulation `biomes` alone
- River/lake sprites from presentation masks via `buildRiverOverlayCanvas.js`, `buildLakeOverlayCanvas.js`
- Resource rasters via `resourceRasterOverlayRefresh.js`
- Vector markers via `worldBuilderMapViewportModel.js` resolvers

### Layer stack (Pixi)

Terrain → contours → resource rasters (arable, timber, metals) → lakes → rivers → vector overlay (`Graphics`) → labels (future).

### Document update locality (#383)

`updateWorldDocument(options)` accepts optional `changedLayers` iterable. Changing only `displayBiomes` should refresh terrain, not full hydrology stack.

Test: `renderer/createWorldBuilderMapViewport.documentUpdate.test.js`.

### Renderer seam contract test

`renderer/rendererSeamContract.test.js` proves:

- Terrain reads `displayBiomes`, invariant to simulation `biomes` when display unchanged
- River overlay reads presentation masks, not `simulationRiverMask` directly for drawing

---

## Part 7 — Seam 6: worker ↔ main thread

### Worker module

`world-builder/worker/derivedGeography.worker.js` imports only:

- `core/derivedGeographyPipeline.js` (`runLandmassPipeline`)
- `worker/createDerivedGeographyWorkerPipelineCallbacks.js`
- `worker/derivedGeographyWorkerProtocol.js`

### Protocol messages

| Message | Payload highlights |
| --- | --- |
| `start` | `DerivedGeographyParams` with **geography seed** |
| step preview | Partial pipeline state / preview **world document** |
| terminal | Final document + validation report |
| `cancel` | Sets cancelled flag; orchestrator marks run stale |

### Clone seam (#366)

`core/cloneWorldDocument.js` (extracted #361) must deep-copy `Uint8Array` fields including `simulationRiverMask` so preview documents do not share buffers with presentation masks.

Tests: `worker/derivedGeographyWorkerProtocol.test.js`, `runDerivedGeographyInWorker.test.js`.

---

## Part 8 — Seam 7: page controller

### Single app seam

`src/composables/useWorldBuilderPageController.js` owns:

- Generation settings binding
- `useWorldBuilderGeneration` + `useWorldBuilderOverlayState` wiring
- Map lifecycle (`worldBuilderGenerationMapLifecycle.js`)
- Validation display model from `worldBuilderPageModel.js`
- Lazy `import('@world-builder/renderer/createWorldBuilderMapViewport.js')`

### Page model

`world-builder/worldBuilderPageModel.js` — pure format helpers:

- `createValidationRowsForDisplay`
- `createHydrologyStatsForDisplay`
- `parseGeographySeedInput`
- No DOM, no Pixi, no worker

### SFC boundary (#368)

`src/pages/projects/WorldBuilderPage.vue` imports only:

- Vue / Quasar
- `useWorldBuilderPageController`
- Exports from `worldBuilderPageModel.js`

Forbidden in SFC `<script setup>`:

- `@world-builder/core/**` direct imports
- Worker imports
- Map viewport factory (except via injected controller test doubles)

### Page controller tests (#375)

`src/composables/useWorldBuilderPageController.test.js` — behavioral matrix for every public method with side effects.

---

## Part 9 — Forbidden imports (hard rules)

### Never allowed

| From | Import | Reason |
| --- | --- | --- |
| `world-builder/core/**` | `world-builder/renderer/**` | Generation must not depend on view |
| `world-builder/worker/**` | `world-builder/renderer/**` | Worker is headless |
| `world-builder/core/**` | `pixi.js`, `pixi-viewport` | No GPU in pipeline |
| `world-builder/core/**` | `vue`, `quasar` | No UI in core |
| `src/pages/projects/WorldBuilderPage.vue` | `@world-builder/core/**` | Use controller/model |
| Generation composables | synchronous renderer imports | Lazy load in controller only |

### Allowed with care

| From | Import | Notes |
| --- | --- | --- |
| `world-builder/renderer/**` | `../core/types.js`, `../core/biomeIds.js` | Types and constants only |
| `world-builder/renderer/**` | `../core/hydrology/riverNetwork.js` | Display assembly in tests only — prefer world document fields in production renderer paths |
| `src/composables/**` | `world-builder/*` entry modules | Not deep core internals |

### Enforcement

- #370 ADR audit greps + seam contract tests
- CI: `rendererSeamContract.test.js`, `worldBuilderGenerationSeamContract.test.js`, `resourceOverlayStateSeamContract.test.js`
- Code review: any new cross-package import requires seam doc update

---

## Part 10 — Seam test catalog (quick reference)

| Seam | Primary test file |
| --- | --- |
| Generation → document | `worldBuilderGenerationSeamContract.test.js` |
| Document → renderer | `renderer/rendererSeamContract.test.js` |
| Overlay owner → viewport | `resourceOverlayStateSeamContract.test.js` |
| Hydrology simulation | `core/hydrology/hydrologyRiverPathfindingSeamContract.test.js` |
| Hydrology lifecycle | `core/hydrology/riverMaskLifecycle.test.js` |
| Document dirty refresh | `renderer/createWorldBuilderMapViewport.documentUpdate.test.js` |
| Cancel / stale run | `worldBuilderGenerationCancel.test.js` |
| End-to-end pipeline | `worldBuilder.integration.test.js` |

Full matrix: [`SEAM-TEST-CATALOG.md`](./SEAM-TEST-CATALOG.md).

---

## Part 11 — Phase 5 deepening targets (#380)

Architecture dry-run verifies three **Strong** deepenings:

1. **Hydrology typed modules** — deletion test: remove one substep file, runner fails with typed missing input (#355, #356).
2. **Vector per-family layer IDs** — overlay owner seam; toggle salt does not redraw coastal (#362, #363).
3. **Landmass contracts derived from stage modules** — no parallel `inputKeys` tables (#359, #360).

If any Strong finding remains at #380, merge is blocked until resolved or explicitly deferred with written rationale in PR body.

---

## Part 12 — Future seams (out of Phase 5 scope)

Documented for orientation only — do not implement in #354:

- **Culture engine** ← **environmental pressure stack** from **landmass** outputs
- **Settlement** placement ← **arable envelope**, **chokepoint**, **trade route** graph
- **History log** ← **history seed** after geography complete
- Export renderers (PNG/SVG) reading same **world document** without Pixi

These follow the same ADR-0009 rule: mutate document, render read-only.
