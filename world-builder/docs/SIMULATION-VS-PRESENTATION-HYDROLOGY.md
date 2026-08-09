# Simulation vs presentation hydrology

World Builder hydrology produces two parallel families of outputs on the same **landmass** grid:

- **Simulation hydrology** — physics-facing centerlines and graphs for **validation checks**, generation reports, and future **logistics pass** work (**movement cost**, **trade route** viability, **maritime reach** inputs).
- **Presentation hydrology** — map-facing geometry for the renderer: widened corridors, optional meander polish, lake display coherence.

Domain glossary: [`world-builder/CONTEXT.md`](../CONTEXT.md). Lifecycle implementation: [`world-builder/core/hydrology/riverMaskLifecycle.js`](../core/hydrology/riverMaskLifecycle.js). Phase 5 issues: #358, #364–#366, #365, #373, #386.

---

## Part 1 — Why two families exist

**Fields before labels** applies to hydrology: drainage **scalar fields** and flow solves produce simulation centerlines first; map cosmetics run afterward.

Presentation refinements (`enableMeanderRefine`, `riverAttractionRadiusScale`) improve GM-facing river aesthetics without lying to **ox paradox**-style logistics math. A **trade route** or navigability **validation check** that read meander-widened masks would overstate river capacity.

ADR-0009 reinforces the split: the renderer is a pure view over presentation fields; simulation fields stay in **world document** for CPU-side consumers.

---

## Part 2 — RiverMaskPipeline stages

Internal pipeline (`riverMaskLifecycle.js`):

| Stage | Substep | Role |
| --- | --- | --- |
| `sketch` | `hydrologyRoute` | Initial routing centerline |
| `incised` | `hydrologyIncise` | Incised channel mask |
| `settled` | `hydrologyExtract` | Post-extract settled simulation centerline |
| `presentation` | `hydrologyRefine` or skip | Optional meander / attraction polish |
| `painted` | `hydrologyPaint` | Corridor width for display and biomes |

**Simulation export** freezes at `settled`. **Presentation export** continues through `presentation` and `painted`.

---

## Part 3 — World document field map

All masks are `Uint8Array` length `gridWidth * gridHeight`, cell values 0 or 1 unless noted.

### 3.1 `simulationRiverMask`

| Property | Value |
| --- | --- |
| **Meaning** | Stable **simulation hydrology** centerline after extract/settle |
| **Pipeline source** | `RiverMaskPipeline.settled` |
| **Typed in** | `world-builder/core/types.js` (`WorldDocument`) |
| **Populated by** | `buildWorldDocumentFromPipelineState.js`, hydrology runner fold |
| **Default Option A** | May byte-match `riverNetworkMask` when presentation refine skipped |

**Simulation hydrology** — logistics-facing. Never widened by presentation-only substeps.

### 3.2 `riverNetworkMask`

| Property | Value |
| --- | --- |
| **Meaning** | Display centerline for river overlay and network assembly |
| **Pipeline source** | `presentation` when refine runs; else `settled` |
| **Populated by** | `derivedGeographyPipeline.js` export path, `buildRiverNetworkMask.js` |
| **Renderer** | `buildRiverOverlayCanvas.js`, `buildRiverOverlayRgba` paths |

**Presentation hydrology** (centerline family). Used for map drawing and `assembleRiverNetwork` display graph.

### 3.3 `riverCorridorMask`

| Property | Value |
| --- | --- |
| **Meaning** | Painted corridor width around centerline |
| **Pipeline source** | `RiverMaskPipeline.painted` only |
| **Populated by** | `hydrologyPaint` substep |
| **Biome refresh** | `classifyBiomesFromFields.js` — river-corridor biome labels |
| **Renderer** | Optional corridor tint; lake coherence helpers |

**Presentation hydrology** (corridor family). Wider than centerline; drives freshwater-adjacent **biome** labels on **displayBiomes**.

### 3.4 Related fields (not interchangeable)

| Field | Family | Notes |
| --- | --- | --- |
| `lakeMask` | Mixed | Simulation fill; display coherence in `lakeDisplayCoherence.js`; **Sail overlay** water union (#388) |
| `channelWidth` | Presentation | Per-cell width metadata for overlay |
| `displayBiomes` | Presentation | Authoritative for terrain tint in renderer |
| `biomes` | Simulation | Field-overlap classification before display smoothing |

### 3.5 **Sail overlay** (derived, not persisted)

| Property | Value |
| --- | --- |
| **Meaning** | Map-truth boat traversability mask: ocean + lakes + corridors → blur → high-pass |
| **Pipeline source** | Derived at validation/renderer seams from `elevation`, `lakeMask`, `riverCorridorMask` |
| **Module** | `core/sail/deriveSailOverlayMask.js`, `computeSailMetrics.js` |
| **Renderer** | Pink raster via `buildSailOverlayRgba.js`; toggle in resource overlay bar |
| **Validation** | `navigableRiverQuota`, `coastMouth`, `coastConnectedNavigablePath` (#388) |

Not stored on **world document**. Single derive function shared by validation and renderer.

---

## Part 4 — Consumer rules (mandatory)

### 4.1 Must use `simulationRiverMask`

| Consumer | Module | Rule |
| --- | --- | --- |
| Geography **validation checks** (sailing) | `core/validation/runGeographyValidationChecks.js` | **Sail overlay** metrics from `core/sail/` (#388, ADR 0010) |
| Geography **validation checks** (Hacks law, parallel strand) | `core/validation/runGeographyValidationChecks.js` | Simulation river graph via `computeHydrologyMetrics` |
| Generation report hydrology section | `core/buildGenerationReport.js` | Sail metrics for movement/coast; graph diagnostics retained under `hydrology` |
| `assembleRiverNetwork` logistics path | `core/hydrology/riverNetwork.js` | Pass `simulationRiverMask` as `simulationCenterline` |
| Future **movement cost** / **trade route** graph | (not Phase 5) | Documented seam for logistics pass |
| Worker / clone round-trip | `cloneWorldDocument.js`, worker protocol | Independent buffer copy (#366) |
| Integration smoke | `worldBuilder.integration.test.js` | Assert populated post-pipeline (#374) |

### 4.2 Must use presentation masks (`riverNetworkMask`, `riverCorridorMask`)

| Consumer | Module | Rule |
| --- | --- | --- |
| River/lake Pixi sprites | `renderer/buildRiverOverlayCanvas.js`, `buildLakeOverlayCanvas.js` | Never draw from `simulationRiverMask` alone |
| Terrain-adjacent biome labels | `classifyBiomesFromFields.js` | `riverCorridorMask` for corridor biomes |
| Display network preview | Renderer seam tests | Presentation centerline for overlay RGBA |
| Authoritative biome refresh after hydrology | `authoritativeBiomeRefreshAfterHydrology.js` | Display-facing classification path |

### 4.3 May use either (with explicit intent)

| Consumer | Guidance |
| --- | --- |
| `computeMetalsRaster.js` | Uses `riverNetworkMask` for upland proximity — presentation centerline acceptable for resource **raster** hint; document if simulation preferred later |
| `derivedGeographyPipeline.arable.test.js` | Test fallback `riverCorridorMask ?? riverNetworkMask` — tests only |
| Debug overlays | Must label simulation vs presentation in dev tools (future) |

### 4.4 Forbidden

| Anti-pattern | Why |
| --- | --- |
| Validation reads `riverNetworkMask` for **sailing checks** when meander enabled | Understates/overstates vs map-truth **Sail overlay** |
| Validation reads `simulationRiverMask` for **sailing checks** | Ignores corridor paint and meander bridges (#388) |
| Renderer reads `simulationRiverMask` for corridor width | Ignores paint stage |
| Test title says "simulation" but asserts only `riverNetworkMask` | False seam coverage (#364) |
| Mutating `simulationRiverMask` in `hydrologyRefine` / `hydrologyPaint` | Breaks byte-invariance (#358) |
| Shared buffer between simulation and presentation masks after clone | Preview corruption (#366) |

---

## Part 5 — Generation options (presentation-only)

From `world-builder/core/types.js` / `worldGenerationOptions`:

| Option | Affects simulation? | Affects presentation? |
| --- | :---: | :---: |
| `enableMeanderRefine: true` | No (`simulationRiverMask`) | Yes — `presentation` stage; **Sail overlay** and sailing validation (#388) |
| `riverAttractionRadiusScale` | No | Yes — path attraction heuristic |
| Default (refine skipped) | — | `riverNetworkMask` may equal `simulationRiverMask` |

**Tests proving invariance:**

- `core/derivedGeographyPipeline.test.js` — meander/attraction toggles
- `core/hydrology/hydrologySubsteps.test.js` — `riverMasksEqual` on simulation mask
- `core/hydrology/riverMaskLifecycle.test.js` — stage order and skipRefine

---

## Part 6 — Data flow diagram

```
scalar fields (drainage, elevation)
        │
        ▼
 hydrology substeps (route → incise → extract → [refine] → paint)
        │
        ├─ simulationRiverMask ◄── settled stage
        │         │
        │         ├── validation (Hacks law, parallel strand, graph diagnostics)
        │         ├── generation report (simulation hydrology block)
        │         └── worker terminal / clone
        │
        ├─ lakeMask + riverCorridorMask + ocean
        │         │
        │         ├── deriveSailOverlayMask (core/sail)
        │         │         ├── sailing validation checks
        │         │         ├── generation report sail metrics
        │         │         └── pink Sail raster overlay
        │
        ├─ riverNetworkMask ◄── presentation or settled centerline
        │         │
        │         └── renderer river overlay
        │
        └─ riverCorridorMask ◄── painted stage
                  │
                  ├── classifyBiomesFromFields (corridor biomes)
                  └── displayBiomes → buildLandTerrainRgba
```

---

## Part 7 — Contract keys (hydrology substep metadata)

River mask stages expose contract keys via `riverMaskContractKey(stage)`:

- `riverMask.sketch`
- `riverMask.incised`
- `riverMask.settled`
- `riverMask.presentation`
- `riverMask.painted`

`hydrologySubstepContracts.js` derives requirements from substep modules (#355, #360 pattern). Pipeline state folds settled into `simulationRiverMask` on **world document** export.

---

## Part 8 — Testing requirements (Phase 5)

| Test file | Assertion |
| --- | --- |
| `hydrologyRiverPathfindingSeamContract.test.js` | Default gen: `simulationRiverMask` length = cell count, count > 0 |
| `riverMaskLifecycle.test.js` | Stage order; skipRefine; presentation transitions |
| `derivedGeographyPipeline.test.js` | Meander on → simulation bytes unchanged; sail metrics may change (#388) |
| `runGeographyValidationChecks.test.js` | Sailing checks respond to presentation corridor bridges (#388); graph checks invariant (#365) |
| `derivedGeographyWorkerProtocol.test.js` | Terminal payload includes simulation mask (#366) |
| `renderer/rendererSeamContract.test.js` | Renderer uses presentation masks for draw |

**Title rule:** If test name contains "simulation", body must assert `simulationRiverMask` (or explicit comparison to presentation with stated purpose).

---

## Part 9 — Glossary additions (#373)

When updating [`CONTEXT.md`](../CONTEXT.md), add Language entries:

### Simulation hydrology

Outputs of the **landmass pipeline** hydrology stages through settled extract: **`simulationRiverMask`**, simulation river graph metrics. Consumed by **validation checks** and future **logistics pass** — not map cosmetics.

_Avoid_: "River network" alone when meaning simulation; using presentation centerline for navigability **validation checks**.

### Presentation hydrology

Map-facing hydrology after optional refine and paint: **`riverNetworkMask`**, **`riverCorridorMask`**, **`displayBiomes`** river labels. Consumed by renderer and display biome refresh.

_Avoid_: Treating presentation corridor width as haul-capacity input; conflating with **simulation hydrology**.

---

## Part 10 — FAQ

**Q: Under defaults, `simulationRiverMask` equals `riverNetworkMask`. Why separate fields?**

A: Option A defaults skip refine, so bytes may match. Logistics consumers still bind to `simulationRiverMask` so enabling meander later does not silently change **validation checks**.

**Q: Which mask for `assembleRiverNetwork`?**

A: Pass both: display centerline from presentation export; `simulationCenterline` from `simulationRiverMask` (`riverNetwork.js`).

**Q: Do lakes use simulation/presentation split?**

A: Lake fill is primarily simulation; display coherence (`lakeDisplayCoherence.js`) is presentation. Full lake split is lighter than rivers in v1 — do not conflate lake display helpers with `simulationRiverMask` rules.

**Q: Preview documents during generation?**

A: Step previews may attach partial documents to the map (`shouldApplyStepPreviewToMap`). Clone seam must deep-copy `simulationRiverMask` so rapid regen does not alias buffers (#366).

---

## Part 11 — Related documents

| Document | Role |
| --- | --- |
| [`RIVER-MASK-LIFECYCLE.md`](./RIVER-MASK-LIFECYCLE.md) | Stage transition detail |
| [`FLOW-FIELD-INVARIANTS.md`](./FLOW-FIELD-INVARIANTS.md) | Full flow solve count |
| [`ARCHITECTURE-SEAMS.md`](./ARCHITECTURE-SEAMS.md) | Seam 3 summary |
| [`SEAM-TEST-CATALOG.md`](./SEAM-TEST-CATALOG.md) | Simulation vs presentation seam tests |
