# Seam test catalog

> **Purpose:** Index every World Builder test file with its architectural seam, primary behaviors, and skip conditions. Phase 5 issues (#364–#375, #369) reference this matrix when adding or tightening seam coverage.
>
> **Scope:** `world-builder/**/*.test.js` (127 files) plus `src/composables/useWorldBuilder*.test.js` (3 files) = **130** catalog entries.
>
> **Last generated:** Run `node world-builder/docs/_generate-seam-catalog.mjs` after adding test files.

---

## How to read this catalog

| Column | Meaning |
|--------|---------|
| **Seam** | Architectural boundary under test (see [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md)) |
| **Behaviors** | What the suite proves — logic and contracts, not UI copy |
| **Skip conditions** | When the suite does not run or is exempt from CI gates |

### Seam type legend

- `core-unit` — Core geography algorithm
- `e2e-integration` — Full pipeline smoke without internal mocks
- `generation-composable` — Generation lifecycle without renderer
- `generation-orchestration` — Progress, cancel, and policy modules
- `hydrology-substep` — Hydrology substep runner and contracts
- `hydrology-unit` — Hydrology algorithm module
- `landmass-contract` — Stage input/output contract derivation
- `landmass-pipeline` — Derived geography pipeline orchestration
- `overlay-composable` — Overlay owner projection to viewport
- `overlay-state` — Resource overlay visibility state machine
- `page-controller` — Vue page controller seam (ADR-0009)
- `page-display-model` — Validation/hydrology display projections
- `renderer-unit` — Renderer canvas and diff helpers
- `research-asset` — Research transcript asset integrity
- `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- `validation-unit` — Generation report and rejection checks
- `viewport-behavior` — Map viewport layer sync and framing
- `worker-protocol` — Worker postMessage and clone round-trip
- `world-builder-unit` — Top-level world-builder module

### Global skip policy (#369, #378)

- Full `npm test` must report **0 skipped** viewport behavioral suites.
- Seam contract tests must not use `readFileSync` source inspection (research asset tests exempt).
- No test title may claim **simulation** while asserting presentation-only fields (#364).

---

## Catalog by area

### `src/composables/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `useWorldBuilderGeneration.test.js` | `generation-composable` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |
| `useWorldBuilderOverlayState.test.js` | `overlay-composable` | toggleVisibility updates owner state and syncs viewport; +5 additional cases | None — runs under npm run test:world-builder |
| `useWorldBuilderPageController.test.js` | `page-controller` | Pipeline cancellation semantics; Seed determinism | None — runs under npm run test:world-builder |

### `world-builder/core/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `assertKnownParams.test.js` | `core-unit` | assertKnownParams accepts only declared keys; +1 additional cases | None — runs under npm run test:world-builder |
| `authoritativeBiomeRefreshAfterHydrology.invocation.test.js` | `core-unit` | non-seasonal full pipeline invokes classifyBiomesWithHydrology only during hydro | None — runs under npm run test:world-builder |
| `authoritativeBiomeRefreshAfterHydrology.test.js` | `core-unit` | Contract derivation or selector wiring; Layer refresh locality; Seed determinism | None — runs under npm run test:world-builder |
| `biomeEdgeNoise.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `buildDisplayBiomes.test.js` | `core-unit` | simulationRiverMask population or invariance | None — runs under npm run test:world-builder |
| `buildGenerationReport.test.js` | `core-unit` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `classifyBiomesFromFields.test.js` | `core-unit` | classifyBiomeFromSample: ${row.name}; +2 additional cases | None — runs under npm run test:world-builder |
| `coast/computeCoastNavigability.test.js` | `core-unit` | computeCoastNavigability is zero on interior land cells; +3 additional cases | None — runs under npm run test:world-builder |
| `coast/computeCoastalProximity.test.js` | `core-unit` | computeCoastalProximityOnLand is zero on ocean cells; +3 additional cases | None — runs under npm run test:world-builder |
| `coast/deriveCoastalNodes.test.js` | `core-unit` | deriveCoastalNodes excludes river mouths within the map edge margin | None — runs under npm run test:world-builder |
| `derivePrevailingWindFromSeed.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `derivedGeographyPipeline.arable.test.js` | `landmass-pipeline` | Seed determinism | None — runs under npm run test:world-builder |
| `derivedGeographyPipeline.metals.test.js` | `landmass-pipeline` | Seed determinism | None — runs under npm run test:world-builder |
| `derivedGeographyPipeline.test.js` | `landmass-pipeline` | simulationRiverMask population or invariance; Flow-field full-flow solve budget invariants; Typed array / graph clone independence; Pipeline cancellation semantics; Contract derivation or selector wiring; Seed determinism | None — runs under npm run test:world-builder |
| `derivedGeographyPipeline.timber.test.js` | `landmass-pipeline` | Seed determinism | None — runs under npm run test:world-builder |
| `elevationMutationClimateRefresh.test.js` | `core-unit` | Layer refresh locality | None — runs under npm run test:world-builder |
| `erosion/applyErosion.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `fields/applyOrographicMoisture.test.js` | `core-unit` | applyOrographicMoisture enhances the windward flank and dries the leeward flank; +1 additional cases | None — runs under npm run test:world-builder |
| `fields/applyRainShadow.test.js` | `core-unit` | applyRainShadow reduces rainfall leeward of a ridge for east wind | None — runs under npm run test:world-builder |
| `fields/computeMoistureAdvection.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `fields/deriveSalinityFromOcean.test.js` | `core-unit` | deriveSalinityFromOcean is 1 at ocean and rim; +3 additional cases | None — runs under npm run test:world-builder |
| `fields/elevationPriors.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `fields/generateDrainage.test.js` | `core-unit` | generateDrainage scales permeability when soilDrainageScale differs from 1 | None — runs under npm run test:world-builder |
| `fields/generateRainfall.test.js` | `core-unit` | generateRainfall scales moisture when rainfallAmountScale differs from 1; +2 additional cases | None — runs under npm run test:world-builder |
| `fields/generateTemperature.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `fields/refreshFieldsAfterErosion.test.js` | `core-unit` | Layer refresh locality | None — runs under npm run test:world-builder |
| `fields/scaleElevationAroundSeaLevel.test.js` | `core-unit` | scaleElevationAroundSeaLevel leaves sea level unchanged; +3 additional cases | None — runs under npm run test:world-builder |
| `generateDerivedGeography.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `generatePhysicalTerrainBaseline.test.js` | `core-unit` | Contract derivation or selector wiring; Seed determinism | None — runs under npm run test:world-builder |
| `grid/gridTopology.test.js` | `core-unit` | cellIndex and cellX/cellY round-trip bounded coordinates; +12 additional cases | None — runs under npm run test:world-builder |
| `gridScaledResourcePlacement.test.js` | `core-unit` | placeMetalNodes enforces grid-scaled spacing at 256²; +8 additional cases | None — runs under npm run test:world-builder |
| `hydrology/applyLiteStreamPower.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/buildRiverGraph.test.js` | `hydrology-unit` | buildRiverGraph rejects unknown parameters; +10 additional cases | None — runs under npm run test:world-builder |
| `hydrology/buildRiverNetworkMask.test.js` | `hydrology-unit` | buildRiverNetworkMask marks downstream corridor cells from lake overflow outlets; +2 additional cases | None — runs under npm run test:world-builder |
| `hydrology/computeCellRunoff.test.js` | `hydrology-unit` | computeDrainageInfiltration caps at 0.8; +3 additional cases | None — runs under npm run test:world-builder |
| `hydrology/computeFlowAccumulation.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/connectNearbyRiverCorridors.test.js` | `hydrology-unit` | connectNearbyRiverCorridors is a no-op when radius is zero; +5 additional cases | None — runs under npm run test:world-builder |
| `hydrology/dInfinityFlow.test.js` | `hydrology-unit` | facetSlope returns null when both neighbors are uphill; +3 additional cases | None — runs under npm run test:world-builder |
| `hydrology/deriveBasinCatchments.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/deriveDrainageFromFlow.test.js` | `hydrology-unit` | deriveDrainageFromFlow normalizes to 0-1 range; +1 additional cases | None — runs under npm run test:world-builder |
| `hydrology/deriveSnowCapMask.test.js` | `hydrology-unit` | deriveSnowCapMask matches glacier elevation and temperature thresholds; +5 additional cases | None — runs under npm run test:world-builder |
| `hydrology/extractRiverNetworkFromIncisedChannels.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/fillLakes.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/fillPolygonMask.test.js` | `hydrology-unit` | fillPolygonMask fills a solid axis-aligned rectangle | None — runs under npm run test:world-builder |
| `hydrology/flowField.test.js` | `hydrology-unit` | deriveOceanMask matches ocean from full flow accumulation; +6 additional cases | None — runs under npm run test:world-builder |
| `hydrology/hydrologyRiverPathfindingSeamContract.test.js` | `runtime-seam-contract` | simulationRiverMask population or invariance; Contract derivation or selector wiring; Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/hydrologySubstepContracts.test.js` | `hydrology-substep` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `hydrology/hydrologySubstepModules.test.js` | `hydrology-substep` | Flow-field solveLog delegate visibility; Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/hydrologySubsteps.test.js` | `hydrology-substep` | simulationRiverMask population or invariance; Flow-field full-flow solve budget invariants; Pipeline cancellation semantics; Contract derivation or selector wiring; Layer refresh locality; Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/lakeBankCrumble.test.js` | `hydrology-unit` | findLargestSeasonalLakeIds prefers the largest lakes without outlets; +5 additional cases | None — runs under npm run test:world-builder |
| `hydrology/lakeDisplayCoherence.test.js` | `hydrology-unit` | assertLakeMaskSurfacesMatchMeta passes for flat aligned lake surfaces; +4 additional cases | None — runs under npm run test:world-builder |
| `hydrology/priorityFloodFill.test.js` | `hydrology-unit` | priorityFloodFill raises a single pit to the lowest spill elevation; +3 additional cases | None — runs under npm run test:world-builder |
| `hydrology/refineRiverNetwork.test.js` | `hydrology-unit` | refineRiverNetworkFromSketch is a no-op mask when sketch is empty; +4 additional cases | None — runs under npm run test:world-builder |
| `hydrology/riverCorridorDisplay.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/riverMaskLifecycle.test.js` | `hydrology-unit` | simulationRiverMask population or invariance; River mask lifecycle substep integration; Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `hydrology/riverNetwork.test.js` | `hydrology-unit` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `hydrology/riverNetworkLegacyMeanders.test.js` | `hydrology-unit` | RIVER_LEGACY_MEANDER_STAGES maps heuristics to hydrology substeps; +5 additional cases | None — runs under npm run test:world-builder |
| `hydrology/riverPathfinding.test.js` | `hydrology-unit` | unitVector and normalizeVector return unit-length directions; +5 additional cases | None — runs under npm run test:world-builder |
| `hydrology/seasonalBiomeDrift.test.js` | `hydrology-unit` | simulationRiverMask population or invariance | None — runs under npm run test:world-builder |
| `hydrology/seasonalClimatology.test.js` | `hydrology-unit` | SEASON_ORDER cycles through four seasons; +7 additional cases | None — runs under npm run test:world-builder |
| `hydrology/seededTemporaryRiverCarve.test.js` | `hydrology-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/settleLakeEquilibrium.test.js` | `hydrology-unit` | Layer refresh locality; Seed determinism | None — runs under npm run test:world-builder |
| `hydrology/simulateSeasonalHydrology.test.js` | `hydrology-unit` | simulateSeasonalHydrology can overtop a closed basin under heavy wet years; +3 additional cases | None — runs under npm run test:world-builder |
| `hydrology/snowWindEffects.test.js` | `hydrology-unit` | computeSnowWindAccumFactor favors leeward cap cells over windward edges; +2 additional cases | None — runs under npm run test:world-builder |
| `landmassPipelineStageContracts.test.js` | `landmass-contract` | Pipeline cancellation semantics; Contract derivation or selector wiring; Layer refresh locality; Seed determinism | None — runs under npm run test:world-builder |
| `landmassPipelineTypes.test.js` | `landmass-contract` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |
| `nodePlacementBounds.test.js` | `core-unit` | isNodePlacementCellAllowed rejects cells within the map edge margin; +1 additional cases | None — runs under npm run test:world-builder |
| `noise/valueNoise2d.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `resourcePlacementScaling.test.js` | `core-unit` | strategicResourceNodeSpacingForGrid matches reference spacing at 256²; +5 additional cases | None — runs under npm run test:world-builder |
| `resources/computeMetalsRaster.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `resources/generateArableRaster.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `resources/generateTimberProductivity.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `resources/placeMetalNodes.test.js` | `core-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `resources/placeSaltNodes.test.js` | `core-unit` | measureLandBiomeFractionWithinRadius counts a 10-cell disk; +8 additional cases | None — runs under npm run test:world-builder |
| `runLandmassPipeline.test.js` | `landmass-pipeline` | Typed array / graph clone independence; Pipeline cancellation semantics; Seed determinism | None — runs under npm run test:world-builder |
| `validation/computeHydrologyMetrics.test.js` | `validation-unit` | simulationRiverMask population or invariance | None — runs under npm run test:world-builder |
| `validation/computeResourceValidationMetrics.test.js` | `validation-unit` | computeArableEnvelopeMetrics counts productive land cells from arable raster; +7 additional cases | None — runs under npm run test:world-builder |
| `validation/computeWindRainfallAsymmetry.test.js` | `validation-unit` | computeWindRainfallAsymmetry reports a positive gap when the windward flank is w; +2 additional cases | None — runs under npm run test:world-builder |
| `validation/elevationPriorPassRates.test.js` | `validation-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `validation/landmassValidationContracts.test.js` | `validation-unit` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `validation/runGeographyValidationChecks.test.js` | `validation-unit` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `validation/runResourceValidationChecks.test.js` | `validation-unit` | runResourceValidationChecks returns resource check ids in stable order; +7 additional cases | None — runs under npm run test:world-builder |
| `validation/shouldRejectGeographyCandidate.test.js` | `validation-unit` | shouldRejectGeographyCandidate is false when only warnings present; +5 additional cases | None — runs under npm run test:world-builder |
| `windClimateIntegration.test.js` | `core-unit` | rotating prevailing wind shifts rainfall, biomes, and rivers end to end | None — runs under npm run test:world-builder |
| `worldGenerationOptions.test.js` | `core-unit` | DEFAULT_WORLD_GENERATION_OPTIONS documents breachThreshold default; +13 additional cases | None — runs under npm run test:world-builder |

### `world-builder/formatPrevailingWind.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/formatPrevailingWind.test.js` | `world-builder-unit` | normalizeWindDegreesForDisplay wraps to 0-359; +2 additional cases | None — runs under npm run test:world-builder |

### `world-builder/renderer/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `biomeIndicesToRgba.test.js` | `renderer-unit` | biomeIndicesToRgba returns RGBA buffer sized width*height*4 | None — runs under npm run test:world-builder |
| `buildArableOverlayCanvas.test.js` | `renderer-unit` | buildArableOverlayRgba returns null when raster is absent; +5 additional cases | None — runs under npm run test:world-builder |
| `buildLakeOverlayCanvas.test.js` | `renderer-unit` | buildLakeOverlayRgba returns null when lakeMask is missing or empty; +5 additional cases | None — runs under npm run test:world-builder |
| `buildLandTerrainRgba.test.js` | `renderer-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `buildMetalsOverlayCanvas.test.js` | `renderer-unit` | buildMetalsOverlayCanvas returns null when metals raster is empty; +3 additional cases | None — runs under npm run test:world-builder |
| `buildResourceRasterOverlayRgba.test.js` | `renderer-unit` | resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch ba; +8 additional cases | None — runs under npm run test:world-builder |
| `buildRiverOverlayCanvas.test.js` | `renderer-unit` | Contract derivation or selector wiring | None — runs under npm run test:world-builder |
| `buildTimberOverlayCanvas.test.js` | `renderer-unit` | buildTimberOverlayRgba returns null when raster is absent; +2 additional cases | None — runs under npm run test:world-builder |
| `buildTopographyContourCanvas.test.js` | `renderer-unit` | buildTopographyContourCanvas returns null for flat submerged terrain; +2 additional cases | None — runs under npm run test:world-builder |
| `createWorldBuilderMapViewport.documentUpdate.test.js` | `viewport-behavior` | updateWorldDocument preserves overlay render cache set by syncOverlayRenderCache; +5 additional cases | May require --experimental-test-module-mocks in npm test (#369) |
| `createWorldBuilderMapViewport.layers.test.js` | `viewport-behavior` | viewport layer stack follows terrain contours arable timber metals lakes rivers ; +1 additional cases | May require --experimental-test-module-mocks in npm test (#369) |
| `createWorldBuilderMapViewport.overlaySync.test.js` | `viewport-behavior` | Layer refresh locality | May require --experimental-test-module-mocks in npm test (#369) |
| `createWorldBuilderMapViewport.overlayVisibility.test.js` | `viewport-behavior` | Typed array / graph clone independence | May require --experimental-test-module-mocks in npm test (#369) |
| `createWorldBuilderMapViewport.viewportFraming.test.js` | `viewport-behavior` | focusOn uses current world document width after regeneration; +3 additional cases | May require --experimental-test-module-mocks in npm test (#369) |
| `diffResourceOverlayMapLayers.test.js` | `renderer-unit` | toggling timber visibility changes only the timber raster layer; +6 additional cases | None — runs under npm run test:world-builder |
| `diffWorldDocumentMapLayers.test.js` | `renderer-unit` | Typed array / graph clone independence | None — runs under npm run test:world-builder |
| `extractTopographyContourSegments.test.js` | `renderer-unit` | Seed determinism | None — runs under npm run test:world-builder |
| `mapLayerRefresh.test.js` | `renderer-unit` | Layer refresh locality | None — runs under npm run test:world-builder |
| `rendererSeamContract.test.js` | `runtime-seam-contract` | simulationRiverMask population or invariance | None — runs under npm run test:world-builder |
| `resourceOverlayVisibility.test.js` | `renderer-unit` | createDefaultResourceOverlayVisibility defaults salt overlay off; +14 additional cases | None — runs under npm run test:world-builder |
| `resourceRasterOverlayRefresh.test.js` | `renderer-unit` | Layer refresh locality | None — runs under npm run test:world-builder |
| `resourceRasterOverlaySeamContract.test.js` | `runtime-seam-contract` | RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition; +1 additional cases | None — runs under npm run test:world-builder |
| `resourceRasterOverlayStyles.test.js` | `renderer-unit` | resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch ba; +2 additional cases | None — runs under npm run test:world-builder |
| `smoothRiverBiomeEdgesInRgba.test.js` | `renderer-unit` | crispRiverEdgeStrength steepens mid-range alpha versus raw blur; +4 additional cases | None — runs under npm run test:world-builder |
| `worldBuilderMapViewportModel.test.js` | `renderer-unit` | computeRegionFocusScale uses the active world width after regeneration; +7 additional cases | None — runs under npm run test:world-builder |

### `world-builder/research/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `researchTranscriptAssets.test.js` | `research-asset` | Layer refresh locality | Skips runtime scan paths listed in RUNTIME_SCAN_SKIP |
| `scripts/srt-to-transcript.test.js` | `research-asset` | srtToTranscript deduplicates rolling captions and strips music markers | None — runs under npm run test:world-builder |

### `world-builder/resourceOverlayState.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/resourceOverlayState.test.js` | `overlay-state` | createResourceOverlayPageState defaults visibility off and uses persisted displa; +9 additional cases | None — runs under npm run test:world-builder |

### `world-builder/resourceOverlayStateSeamContract.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/resourceOverlayStateSeamContract.test.js` | `runtime-seam-contract` | useWorldBuilderOverlayState seam routes toggle through syncOverlayRenderCache on; +4 additional cases | None — runs under npm run test:world-builder |

### `world-builder/resourceOverlays.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/resourceOverlays.test.js` | `overlay-state` | createResourceOverlayDefinitions lists canonical overlay ids and kinds; +18 additional cases | None — runs under npm run test:world-builder |

### `world-builder/runDerivedGeographyInWorker.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/runDerivedGeographyInWorker.test.js` | `worker-protocol` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |

### `world-builder/worker/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `derivedGeography.worker.test.js` | `worker-protocol` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |
| `derivedGeographyWorkerProtocol.test.js` | `worker-protocol` | Pipeline cancellation semantics; Contract derivation or selector wiring | None — runs under npm run test:world-builder |

### `world-builder/worldBuilder.integration.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilder.integration.test.js` | `e2e-integration` | world builder route is a MainLayout child; +8 additional cases | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderGenerationCancel.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderGenerationCancel.test.js` | `generation-orchestration` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderGenerationMapLifecycle.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderGenerationMapLifecycle.test.js` | `generation-orchestration` | concurrent applyWorldDocument calls create viewport only once; +8 additional cases | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderGenerationOrchestrator.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderGenerationOrchestrator.test.js` | `generation-orchestration` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderGenerationPolicy.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderGenerationPolicy.test.js` | `generation-orchestration` | generationProgressValue scales by completed steps; +7 additional cases | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderGenerationSeamContract.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderGenerationSeamContract.test.js` | `runtime-seam-contract` | Pipeline cancellation semantics | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderOverlayControls.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderOverlayControls.test.js` | `world-builder-unit` | createDefaultOverlayDisplaySettings includes arableMinimumProductivity default; +1 additional cases | None — runs under npm run test:world-builder |

### `world-builder/worldBuilderPageModel.test.js/`

| File | Seam | Behaviors | Skip conditions |
|------|------|-----------|------------------|
| `world-builder/worldBuilderPageModel.test.js` | `page-display-model` | Contract derivation or selector wiring; Seed determinism | None — runs under npm run test:world-builder |

---

## Detailed entries (alphabetical)

Each file lists individual `test(...)` titles for reviewer grep and #375 controller matrix cross-check.

### `src/composables/useWorldBuilderGeneration.test.js`

- **Seam:** `generation-composable` — Generation lifecycle without renderer
- **Test count:** 11
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - metadata-only step-complete does not update world document or apply map
  - complete, cancelled, and error terminals do not apply map
  - onWorldDocument stores world document ref before applyWorldDocument
  - regenerate completes with success run phase and shows overlay bar
  - regenerate completes with exhausted run phase and validation banner
  - dispose via cancelActive leaves run phase cancelled and resets progress
  - worker onError sets run phase error and forwards message
  - applyWorldDocument rejection sets run phase error
  - regenerate skips when geography params are unavailable
  - onBeforeRun and onRunCompleteSuccess hooks fire around a successful run
  - superseding regenerate ignores stale terminal callbacks from prior run

### `src/composables/useWorldBuilderOverlayState.test.js`

- **Seam:** `overlay-composable` — Overlay owner projection to viewport
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** toggleVisibility updates owner state and syncs viewport; +5 additional cases
- **Cases:**
  - toggleVisibility updates owner state and syncs viewport
  - setDisplaySetting persists to settings store once and syncs viewport
  - resetVisibility clears toggles without changing persisted display settings
  - applyPersistedDefaults restores display settings and visibility from store
  - syncToViewport re-projects unchanged owner state when viewport becomes ready
  - hydrateFromPersistedSettings loads store display settings without viewport sync

### `src/composables/useWorldBuilderPageController.test.js`

- **Seam:** `page-controller` — Vue page controller seam (ADR-0009)
- **Test count:** 10
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics; Seed determinism
- **Cases:**
  - start runs initial generation and applies the world document to the map
  - destroy cancels the active run and tears down the map lifecycle
  - regenerate starts a fresh generation run
  - committing a slider value persists to settings and regenerates
  - committing a seed applies it to settings and regenerates
  - resetDefaults resets settings, restores overlay display settings, and regenerates
  - focusValidationRow focuses the viewport only when the row has a map focus
  - a completed run resets overlay visibility
  - resetOverlays clears overlay visibility without regenerating
  - generation errors are forwarded to the error handler

### `world-builder/core/assertKnownParams.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** assertKnownParams accepts only declared keys; +1 additional cases
- **Cases:**
  - assertKnownParams accepts only declared keys
  - assertKnownParams rejects unknown keys with a labeled error

### `world-builder/core/authoritativeBiomeRefreshAfterHydrology.invocation.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** non-seasonal full pipeline invokes classifyBiomesWithHydrology only during hydro
- **Cases:**
  - non-seasonal full pipeline invokes classifyBiomesWithHydrology only during hydrology

### `world-builder/core/authoritativeBiomeRefreshAfterHydrology.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring; Layer refresh locality; Seed determinism
- **Cases:**
  - fieldRefresh contract documents seasonal-only responsibility
  - fieldRefresh pass-through preserves hydrology exit climate scalars and biomes
  - non-seasonal full pipeline final climate fields and biomes match hydrology exit
  - non-seasonal full pipeline seed 12345 preserves golden climate and biome checksums
  - field refresh stage input carries hydrology biomes for pass-through

### `world-builder/core/biomeEdgeNoise.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateBiomeEdgeNoiseOffsets is deterministic for the same seed
  - generateBiomeEdgeNoiseOffsets differs across seeds
  - generateBiomeEdgeNoiseOffsets returns null at zero strength
  - generateBiomeEdgeNoiseOffsets scales with strength
  - generateBiomeEdgeNoiseOffsets stays within configured amplitude
  - classifyBiomesFromFields roughens inland biome edges when geography seed is provided
  - classifyBiomesFromFields leaves ocean and coast unchanged by edge noise
  - zero biome edge noise strength matches unseeded classification

### `world-builder/core/buildDisplayBiomes.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance
- **Cases:**
  - buildDisplayBiomes replaces river corridor with underlying land biome
  - buildDisplayBiomes leaves non-river simulation biomes unchanged
  - generateDerivedGeography includes displayBiomes with no river corridor indices

### `world-builder/core/buildGenerationReport.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - buildGenerationReport includes hydrology breach and endorheic stats
  - buildGenerationReport lists hydrology validation metrics
  - buildGenerationReport includes hydrology validation rows
  - buildGenerationReport exposes logistics-facing validation signals
  - buildGenerationReport surfaces structured rejection reasons for enforced failures
  - buildGenerationReport passes precomputed hydrology metrics into validation
  - buildGenerationReport includes resource validation rows from current contract
  - buildGenerationReport rejects enforced strategic resource spacing violations

### `world-builder/core/classifyBiomesFromFields.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** classifyBiomeFromSample: ${row.name}; +2 additional cases
- **Cases:**
  - classifyBiomeFromSample: ${row.name}
  - classifyBiomesWithHydrology applies lake mask over land biomes
  - classifyBiomesWithHydrology paints river corridor cells from mask

### `world-builder/core/coast/computeCoastNavigability.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeCoastNavigability is zero on interior land cells; +3 additional cases
- **Cases:**
  - computeCoastNavigability is zero on interior land cells
  - computeCoastNavigability increases with ocean depth
  - computeCoastNavigability favors sheltered bays beside tall coast
  - computeCoastNavigability stays within normalized range on mixed coast

### `world-builder/core/coast/computeCoastalProximity.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeCoastalProximityOnLand is zero on ocean cells; +3 additional cases
- **Cases:**
  - computeCoastalProximityOnLand is zero on ocean cells
  - computeCoastalProximityOnLand peaks on shoreline land cells
  - computeCoastalProximityOnLand decays with distance from coast
  - computeCoastalProximityOnLand scaled maxDistance reaches proportionally further inland

### `world-builder/core/coast/deriveCoastalNodes.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** deriveCoastalNodes excludes river mouths within the map edge margin
- **Cases:**
  - deriveCoastalNodes excludes river mouths within the map edge margin

### `world-builder/core/derivePrevailingWindFromSeed.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - derivePrevailingWindFromSeed returns 0-359 and is deterministic

### `world-builder/core/derivedGeographyPipeline.arable.test.js`

- **Seam:** `landmass-pipeline` — Derived geography pipeline orchestration
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - runFullDerivedGeographyPipeline includes arable raster on world document
  - runFullDerivedGeographyPipeline arable raster is deterministic for same seed
  - runFullDerivedGeographyPipeline arable is higher on river corridors than arid highlands

### `world-builder/core/derivedGeographyPipeline.metals.test.js`

- **Seam:** `landmass-pipeline` — Derived geography pipeline orchestration
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - runFullDerivedGeographyPipeline includes metals raster and nodes on world document
  - runFullDerivedGeographyPipeline metal nodes are deterministic for fixed seed
  - runFullDerivedGeographyPipeline respects maxMetalNodes option
  - runFullDerivedGeographyPipeline places no metal nodes when maxMetalNodes is zero
  - runFullDerivedGeographyPipeline metals are higher in mountain biomes than grassland

### `world-builder/core/derivedGeographyPipeline.test.js`

- **Seam:** `landmass-pipeline` — Derived geography pipeline orchestration
- **Test count:** 27
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance; Flow-field full-flow solve budget invariants; Typed array / graph clone independence; Pipeline cancellation semantics; Contract derivation or selector wiring; Seed determinism
- **Cases:**
  - runFullDerivedGeographyPipeline matches generateDerivedGeography
  - runPipelineStep produces preview documents at each stage
  - world document exposes a populated simulation river mask after hydrology
  - default generation simulation river mask equals the settled display centerline
  - world document simulation river mask is invariant to corridor attraction
  - validation hydrology metrics read the simulation centerline, not presentation refinements
  - default derived geography hydrology performs three full flow solves
  - seasonal hydrology does not add full flow solves beyond the baseline three
  - runPipelineStep hydrology records substep timings on state
  - runPipelineStep hydrology skips hydrologyRefine when enableMeanderRefine is false by default
  - full pipeline generation report includes hydrology substep timings
  - full pipeline includes lakeMeta and hydrology breach stats
  - buildWorldDocumentFromPipelineState includes lakeMeta after hydrology
  - hydrology persists channelWidth on pipeline state and world document
  - cloneWorldDocument copies displayBiomes independently
  - cloneWorldDocument copies salinity field independently
  - cloneWorldDocument copies arableRaster independently
  - cloneWorldDocument copies metalsRaster and metalNodes independently
  - worker step-complete clone round trip preserves metals raster and nodes
  - cloneWorldDocument copies lakeMeta independently
  - cloneWorldDocument copies the simulation river mask independently
  - worker step-complete clone round trip preserves the simulation river mask
  - runFullDerivedGeographyPipeline throws when validation retries are exhausted
  - runLandmassPipelineRun exhausts validation retries with incremented seed
  - runPipelineStep validation emits contract-backed generation report
  - DERIVED_GEOGRAPHY_STEPS has stable step ids
  - runPipelineStep hydrology forwards substep hooks and cancel

### `world-builder/core/derivedGeographyPipeline.timber.test.js`

- **Seam:** `landmass-pipeline` — Derived geography pipeline orchestration
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - runFullDerivedGeographyPipeline includes timber raster on world document
  - runFullDerivedGeographyPipeline timber raster is deterministic for same seed
  - runFullDerivedGeographyPipeline timber is higher in forest biomes than barren biomes

### `world-builder/core/elevationMutationClimateRefresh.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 10
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Layer refresh locality
- **Cases:**
  - refreshClimateScalarsAfterElevationMutation temperature and rainfall track mutated elevation
  - refreshClimateScalarsAfterElevationMutation salinity tracks synthetic elevation breach
  - runPipelineStep erosion preview climate scalars match refresh hook with prevailing wind
  - runPipelineStep erosion preview salinity matches eroded elevation coast distance
  - runPipelineStep erosion preview salinity is not frozen pre-erosion raster
  - runPipelineStep hydrology preview salinity is not frozen pre-erosion raster
  - runPipelineStep hydrology preview salinity matches settled elevation coast distance
  - buildWorldDocumentFromPipelineState erosion and hydrology previews carry fresh salinity
  - field refresh stage input salinity from hydrology is fresh for working elevation
  - full pipeline salinity unchanged after elevation-mutation refresh hooks

### `world-builder/core/erosion/applyErosion.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - applyErosion is deterministic for same seed
  - applyErosion produces fixed snapshot count for default steps
  - applyErosion lowers high ground along flow paths
  - applyErosion deepens channels toward lower neighbors
  - applyErosion does not raise ocean cells to sea level
  - applyErosion lets coastal lowland export sediment off the map edge
  - applyErosion does not export highland sediment off the map edge

### `world-builder/core/fields/applyOrographicMoisture.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** applyOrographicMoisture enhances the windward flank and dries the leeward flank; +1 additional cases
- **Cases:**
  - applyOrographicMoisture enhances the windward flank and dries the leeward flank
  - applyOrographicMoisture with liftStrength 0 only dries leeward cells

### `world-builder/core/fields/applyRainShadow.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** applyRainShadow reduces rainfall leeward of a ridge for east wind
- **Cases:**
  - applyRainShadow reduces rainfall leeward of a ridge for east wind

### `world-builder/core/fields/computeMoistureAdvection.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - computeMoistureAdvection makes the windward coast wetter than the interior
  - rotating the wind 180 degrees swaps which coast is wetter
  - computeMoistureAdvection is deterministic for the same inputs
  - computeMoistureAdvection preserves golden checksums for representative seeds

### `world-builder/core/fields/deriveSalinityFromOcean.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** deriveSalinityFromOcean is 1 at ocean and rim; +3 additional cases
- **Cases:**
  - deriveSalinityFromOcean is 1 at ocean and rim
  - deriveSalinityFromOcean tapers with distance from coast
  - deriveSalinityFromOcean respects active sea level
  - deriveSalinityFromOcean defaults sea level to pipeline constant

### `world-builder/core/fields/elevationPriors.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateElevation is deterministic with elevation priors enabled
  - domain warp changes elevation relief vs warp disabled
  - coast-distance bias lowers near-coast land relative to inland
  - mid-level smoothing reduces relief in mid elevations while preserving peaks
  - slope-dependent roughness adds more relief on steep cells than gentle cells
  - gentle-slope HF reduction lowers relief on low-slope cells
  - computeLandCoastDistance completes on full grid without queue blow-up
  - default elevation priors widen inland-coastal elevation gap vs pre-priors baseline

### `world-builder/core/fields/generateDrainage.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** generateDrainage scales permeability when soilDrainageScale differs from 1
- **Cases:**
  - generateDrainage scales permeability when soilDrainageScale differs from 1

### `world-builder/core/fields/generateRainfall.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** generateRainfall scales moisture when rainfallAmountScale differs from 1; +2 additional cases
- **Cases:**
  - generateRainfall scales moisture when rainfallAmountScale differs from 1
  - generateRainfall preserves spatial pattern when rainfallAmountScale changes
  - generateRainfall responds to prevailing wind direction over a ridge

### `world-builder/core/fields/generateTemperature.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateTemperature returns finite values for a 1-row grid
  - generateTemperature returns finite values for a 1-column grid
  - generateTemperature cools poleward rows relative to the equator band
  - generateTemperature applies elevation lapse cooling
  - generateTemperature is deterministic for the same geography seed
  - generateTemperature matches pre-#316 output on multi-row representative seeds
  - generateTemperature 1-row and 1-col grids are intentionally fixed (#316 degenerate-grid guard)
  - generateTemperature preserves golden checksums for representative seeds

### `world-builder/core/fields/refreshFieldsAfterErosion.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Layer refresh locality
- **Cases:**
  - refreshFieldsAfterErosion recomputes all fields from eroded elevation
  - refreshFieldsAfterErosion uses prevailing wind for rainfall
  - refreshFieldsAfterErosion temperature tracks elevation
  - refreshFieldsAfterErosion salinity respects active sea level option

### `world-builder/core/fields/scaleElevationAroundSeaLevel.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** scaleElevationAroundSeaLevel leaves sea level unchanged; +3 additional cases
- **Cases:**
  - scaleElevationAroundSeaLevel leaves sea level unchanged
  - scaleElevationAroundSeaLevel amplifies highs and deepens lows
  - scaleElevationAroundSeaLevel flattens relief below 1
  - scaleElevationAroundSeaLevel clamps to normalized range

### `world-builder/core/generateDerivedGeography.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 14
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateDerivedGeography defaults to 1024 grid
  - generateDerivedGeography emits landmass pipeline fields and hydrology report
  - generateDerivedGeography arable favors river corridor temperate cells over mountain desert
  - generateDerivedGeography is deterministic for same seed and wind
  - generateDerivedGeography differs for different seeds
  - generateDerivedGeography completes for default geography seed
  - generateDerivedGeography default seed produces visible river network on full grid
  - generateDerivedGeography seed 77814242 detects river mouths at shoreline drainage cells
  - generateDerivedGeography default seed keeps lake surfaces aligned with lakeMeta
  - generateDerivedGeography default seed applies stream-power incision to elevation
  - generateDerivedGeography uses flow-derived drainage not noise
  - runLandmassPipelineRun extreme seed reports identifiable hydrology validation metrics
  - generateDerivedGeography throws when validation retries are exhausted
  - runLandmassPipelineRun retries with incremented seed when validation rejects

### `world-builder/core/generatePhysicalTerrainBaseline.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring; Seed determinism
- **Cases:**
  - generatePhysicalTerrainBaseline defaults to 1024 grid
  - generatePhysicalTerrainBaseline records physical terrain baseline stage metadata
  - generatePhysicalTerrainBaseline is deterministic for same seed and wind
  - generatePhysicalTerrainBaseline differs for different seeds
  - generatePhysicalTerrainBaseline emits closed island rim ocean at corners
  - generatePhysicalTerrainBaseline temperature rises toward equator on default seed
  - generatePhysicalTerrainBaseline scalar fields include salinity contract key
  - generatePhysicalTerrainBaseline includes palette-ready displayBiomes
  - generatePhysicalTerrainBaseline salinity shifts with custom sea level

### `world-builder/core/grid/gridTopology.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 13
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** cellIndex and cellX/cellY round-trip bounded coordinates; +12 additional cases
- **Cases:**
  - cellIndex and cellX/cellY round-trip bounded coordinates
  - isInBounds rejects out-of-range coordinates
  - forEachCell visits every cell in row-major order
  - forEachNeighbor4 visits only in-bounds orthogonal neighbors
  - collectConnectedComponents finds 4-connected mask regions
  - labelConnectedComponents assigns stable component ids
  - computeLandCoastDistance increases inland from a coast
  - localSlopeMaxAbsDelta and localSlopeMaxDropPerDistance agree on flat terrain
  - manhattanAdjacent and cellDistance describe orthogonal neighbors
  - clamp01 clamps to the unit interval
  - computeLandCoastDistance matches pre-extraction chamfer on fixed fixture
  - localSlopeMaxAbsDelta matches pre-extraction arable slope helper on fixed fixture
  - localSlopeMaxDropPerDistance matches pre-extraction hydrology slope helper on fixed fixture

### `world-builder/core/gridScaledResourcePlacement.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** placeMetalNodes enforces grid-scaled spacing at 256²; +8 additional cases
- **Cases:**
  - placeMetalNodes enforces grid-scaled spacing at 256²
  - placeMetalNodes enforces grid-scaled spacing at 1024²
  - placeSaltNodes enforces grid-scaled spacing at 256²
  - placeSaltNodes enforces grid-scaled spacing at 1024²
  - runFullDerivedGeographyPipeline applies configured arable minimum productivity at 256²
  - runFullDerivedGeographyPipeline applies configured arable minimum productivity at 1024²
  - runFullDerivedGeographyPipeline arable threshold matches generation default at 256²
  - runFullDerivedGeographyPipeline arable threshold matches generation default at 1024²
  - runFullDerivedGeographyPipeline higher arable threshold yields fewer productive cells at 256²

### `world-builder/core/hydrology/applyLiteStreamPower.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - clampStreamPowerOptions caps iteration count and coefficients
  - applyLiteStreamPower erodes initiating channel cells deterministically
  - applyLiteStreamPower deposits on low-slope downstream corridor reaches
  - applyLiteStreamPower lowers mean trunk gradient vs pre-iteration
  - applyLiteStreamPower reports fractional progress across iterations

### `world-builder/core/hydrology/buildRiverGraph.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 11
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildRiverGraph rejects unknown parameters; +10 additional cases
- **Cases:**
  - buildRiverGraph rejects unknown parameters
  - buildRiverGraph rejects legacy elevation and seaLevel parameters
  - buildRiverGraph creates mouth nodes at coast on gentle ramp
  - buildRiverGraph marks every edge as navigable
  - buildNavigableRiverMask marks cells along graph edges
  - buildRiverGraph with channelMask only emits nodes on masked cells
  - buildRiverGraph stays sparse on a 64x64 generated elevation field
  - buildRiverGraph creates mouth nodes when downstream cell is ocean
  - buildRiverGraph rejects mouth nodes on channel dribbles shorter than minimum length
  - qualifiesAsRiverMouth counts upstream cells in the channel mask
  - isRiverMouthDrainageCell requires ocean downstream

### `world-builder/core/hydrology/buildRiverNetworkMask.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildRiverNetworkMask marks downstream corridor cells from lake overflow outlets; +2 additional cases
- **Cases:**
  - buildRiverNetworkMask marks downstream corridor cells from lake overflow outlets
  - buildRiverNetworkMask marks coastal tributaries draining to ocean
  - buildRiverNetworkMask stays empty when no coastal outlets exist

### `world-builder/core/hydrology/computeCellRunoff.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeDrainageInfiltration caps at 0.8; +3 additional cases
- **Cases:**
  - computeDrainageInfiltration caps at 0.8
  - computeCellRunoff applies rainfall infiltration and snow melt
  - computeCellRunoff enforces RUNOFF_EPSILON on bare land
  - facetSlope returns split fraction between two downhill neighbors

### `world-builder/core/hydrology/computeFlowAccumulation.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 13
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - highland near closed rim drains inland rather than into the map edge
  - coastal lowland adjacent to closed rim can drain into map-edge ocean
  - doubling rainfall at least doubles mouth flux on a fixed watershed
  - high infiltration reduces mouth flux versus low infiltration
  - rain shadow lower rainfall yields lower downstream accumulation
  - D-infinity splits flow across a ridge facet on a filled DEM
  - flow accumulation is deterministic for fixed grids
  - downstream discharge is monotonic along a single D8 trunk
  - wet climate yields higher mouth flux than dry on the same watershed
  - computeFlowAccumulation requires rainfall
  - downstreamIndex returns -1 when flow direction points outside the grid
  - computeFlowPartitions keep downstream indices inside the grid on rim terrain
  - computeFlowAccumulation never writes flow accumulation outside the grid

### `world-builder/core/hydrology/connectNearbyRiverCorridors.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** connectNearbyRiverCorridors is a no-op when radius is zero; +5 additional cases
- **Cases:**
  - connectNearbyRiverCorridors is a no-op when radius is zero
  - connectNearbyRiverCorridors links nearby components through a low saddle
  - connectNearbyRiverCorridors meanders instead of cutting straight across
  - connectNearbyRiverCorridors merges tributaries at acute angles
  - connectNearbyRiverCorridors does not connect parallel coastal rivers
  - connectNearbyRiverCorridors does not bridge already-connected rivers

### `world-builder/core/hydrology/dInfinityFlow.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** facetSlope returns null when both neighbors are uphill; +3 additional cases
- **Cases:**
  - facetSlope returns null when both neighbors are uphill
  - D8 fallback routes tiny upslope-area headwaters through a single downstream cell
  - partitionsToFlowDirection exposes primary D8 direction for graph tracing
  - D8_FALLBACK_MAX_AREA bounds headwater fallback routing

### `world-builder/core/hydrology/deriveBasinCatchments.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - deriveBasinCatchments maps hillside cells into lake catchments
  - buildLakeIdByCell throws when lake metadata cannot be matched to a mask component
  - buildLakeIdByCell maps spill-adjacent components to lake records
  - buildLakeIdByCell resolves fillLakes metadata for representative geography seeds (#316)
  - deriveBasinCatchments preserves golden catchment checksums for representative seeds

### `world-builder/core/hydrology/deriveDrainageFromFlow.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** deriveDrainageFromFlow normalizes to 0-1 range; +1 additional cases
- **Cases:**
  - deriveDrainageFromFlow normalizes to 0-1 range
  - deriveDrainageFromFlow returns zeros for empty flow

### `world-builder/core/hydrology/deriveSnowCapMask.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** deriveSnowCapMask matches glacier elevation and temperature thresholds; +5 additional cases
- **Cases:**
  - deriveSnowCapMask matches glacier elevation and temperature thresholds
  - deriveSnowMeltContribution adds flow only on snow-cap edge cells
  - deriveSnowMeltContribution skips interior snow-cap cells
  - deriveSnowMeltContribution favors leeward cap edges for outlet placement
  - snow melt on a peak produces a river corridor downhill to the sea
  - buildRiverNetworkMask includes streams that terminate in inland lakes

### `world-builder/core/hydrology/extractRiverNetworkFromIncisedChannels.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - buildIncisedChannelMask traces only from incised mouths meeting flow cutoff
  - buildIncisedChannelMask does not flood entire watershed from incised cells
  - selectIncisedChannelSeeds returns only coastal and lake mouths on incised corridor
  - extractRiverNetworkFromIncisedChannels merges tributary discharge monotonically downstream
  - extractRiverNetworkFromIncisedChannels places mouth nodes at coastal drainage cells
  - buildChannelWidthField is zero outside channel mask and positive inside major channels
  - extractRiverNetworkFromIncisedChannels omits coast navigability from its return value
  - extractRiverNetworkFromIncisedChannels marks every graph edge as navigable
  - extractRiverNetworkFromIncisedChannels produces non-empty graph for default pipeline seed

### `world-builder/core/hydrology/fillLakes.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 11
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - fillLakes fills synthetic bowl depression
  - fillLakes ignores tiny depressions
  - fillLakes breaches low saddle when spill depth is shallow relative to basin depth
  - fillLakes keeps high saddle basins endorheic
  - fillLakes useDryFloorInitialLevel starts endorheic basins at floor elevation
  - fillLakes breach evaluation is deterministic on fixed grids
  - fillLakes breachThreshold toggles classification on the same grid
  - fillLakes breached outlet enables flow to leave the basin
  - fillLakes endorheic basin blocks outlet flow at filled surface
  - fillLakes lakeMeta aligns with lakes records
  - fillLakes reports breach and endorheic counts

### `world-builder/core/hydrology/fillPolygonMask.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** fillPolygonMask fills a solid axis-aligned rectangle
- **Cases:**
  - fillPolygonMask fills a solid axis-aligned rectangle

### `world-builder/core/hydrology/flowField.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** deriveOceanMask matches ocean from full flow accumulation; +6 additional cases
- **Cases:**
  - deriveOceanMask matches ocean from full flow accumulation
  - recomputeFullFlow matches computeFlowAccumulation and attaches stage metadata
  - createFlowFieldSession caches full flow when elevation is unchanged
  - createFlowFieldSession invalidates cache when elevation changes
  - deriveOceanMask does not increment full flow solve count
  - FLOW_RECOMPUTE_REASONS pairs each hydrology stage with a stable reason id
  - createFlowFieldSession solveLog records reason and stage for each uncached recompute

### `world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js`

- **Seam:** `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance; Contract derivation or selector wiring; Seed determinism
- **Cases:**
  - routeFractalCorridorPath connects endpoints for the legacy attraction profile
  - routeFractalCorridorPath connects endpoints for the meander refine profile
  - routeFractalCorridorPath is deterministic for a fixed random stream
  - fractal corridor depth profiles diverge between attraction and meander routing
  - fallbackCorridorLine produces a contiguous straight corridor between endpoints
  - hydrology substeps drive the river mask lifecycle through the shared pipeline
  - hydrology substep contracts expose explicit river mask lifecycle stages
  - issue #345 Option A defaults keep legacy presentation heuristics off
  - default generation exports simulation centerline and presentation corridor mask

### `world-builder/core/hydrology/hydrologySubstepContracts.test.js`

- **Seam:** `hydrology-substep` — Hydrology substep runner and contracts
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - HYDROLOGY_SUBSTEP_IDS matches hydrology substep module order
  - substep contracts are derived from the substep modules as a single source of truth
  - each hydrology substep declares a narrow non-empty input and output interface
  - selectHydrologySubstepInput yields exactly the contract input keys
  - river mask lifecycle stages are produced across the substep contracts in order
  - hydrology contracts omit orphaned waterway navigability fields

### `world-builder/core/hydrology/hydrologySubstepModules.test.js`

- **Seam:** `hydrology-substep` — Hydrology substep runner and contracts
- **Test count:** 14
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Flow-field solveLog delegate visibility; Seed determinism
- **Cases:**
  - hydrologyFill module derives an ocean mask and fills lakes from its narrow input
  - hydrologyFill module deriveOceanMask does not perform a full flow solve
  - composition does not seed a nullable context: produced keys appear only after their substep
  - hydrologyClimate module recomputes rainfall and temperature on eroded elevation
  - hydrologyRoute module performs exactly one full flow solve and sets the sketch mask
  - hydrologyIncise module carves elevation and sets the incised mask
  - hydrologyExtract module performs the post-incision flow solve and builds a river graph
  - hydrologyExtract delegate records post-incision flow solve on the session solveLog
  - hydrologyRefine module is skipped when meander refine is disabled, copying settled to presentation
  - hydrologyRefine module runs and produces a presentation mask when meander refine is enabled
  - hydrologySettle module performs the post-equilibrium flow solve and derives drainage
  - hydrologySettle module records post-equilibrium flow solve on the session solveLog
  - hydrologyPaint module assembles the river network and paints the corridor mask
  - hydrologyPaint module reports inner progress through the shared onProgress callback

### `world-builder/core/hydrology/hydrologySubsteps.test.js`

- **Seam:** `hydrology-substep` — Hydrology substep runner and contracts
- **Test count:** 31
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance; Flow-field full-flow solve budget invariants; Pipeline cancellation semantics; Contract derivation or selector wiring; Layer refresh locality; Seed determinism
- **Cases:**
  - HYDROLOGY_SUBSTEPS lists nine substeps in canonical order
  - runHydrologySubsteps performs three full flow solves per world
  - runHydrologySubsteps routes every full flow solve through the flowField session
  - runHydrologySubsteps with seasonal hydrology enabled keeps three full flow solves
  - runHydrologySubsteps invokes seasonal between climate and route
  - runHydrologySubsteps invokes climate before route
  - runHydrologySubsteps matches runPipelineStep hydrology output
  - runHydrologySubsteps flattens hydrologyPaint riverNetwork contract onto state
  - readRiverNetworkFromWorldDocument exposes the simulation centerline distinct from presentation
  - runHydrologySubsteps does not populate coast navigability on pipeline state
  - runHydrologySubsteps exposes lakeMeta and hydrology stats on state
  - runHydrologySubsteps aborts when shouldCancel returns true
  - runHydrologySubsteps records per-substep timings
  - runHydrologySubsteps climate refresh recomputes rainfall and temperature on eroded elevation
  - runHydrologySubsteps emits substep lifecycle hooks in order
  - runHydrologySubsteps emits inner progress during hydrologyIncise carve
  - runHydrologySubsteps emits inner progress during hydrologyPaint
  - runHydrologySubsteps passes post-carve elevation downstream
  - runHydrologySubsteps keeps channelWidth aligned with settled drainage
  - runHydrologySubsteps places settled mouth nodes at ocean drainage cells
  - runHydrologySubsteps settle keeps lake surfaces aligned with lakeMeta
  - fillLakes returns priority-flood spill outlets after breach evaluation
  - runHydrologySubsteps skips hydrologyRefine when enableMeanderRefine is false
  - runHydrologySubsteps runs hydrologyRefine when enableMeanderRefine is true
  - enableMeanderRefine allows presentation mask changes and valley carving
  - legacy meander refine leaves the simulation river mask unchanged
  - legacy corridor attraction leaves the simulation river mask unchanged
  - runHydrologySubsteps reports mask lifecycle transitions at substep seams
  - runHydrologySubsteps produces painted corridor and centerline masks
  - skip refine transition is deterministic for a fixed seed
  - default seed batch completes without rejection when legacy heuristics are off

### `world-builder/core/hydrology/lakeBankCrumble.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** findLargestSeasonalLakeIds prefers the largest lakes without outlets; +5 additional cases
- **Cases:**
  - findLargestSeasonalLakeIds prefers the largest lakes without outlets
  - findLowestBankOutlet picks the lowest exterior rim cell
  - applyAnnualLargestLakeBankCrumble opens the largest lake at its lowest bank
  - simulateSeasonalHydrology crumbles the largest lake again when it stays largest
  - applyAnnualLargestLakeBankCrumble crumbles the n largest lakes when crumbleCount > 1
  - applyAnnualLargestLakeBankCrumble opens the next bank on a repeat year

### `world-builder/core/hydrology/lakeDisplayCoherence.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** assertLakeMaskSurfacesMatchMeta passes for flat aligned lake surfaces; +4 additional cases
- **Cases:**
  - assertLakeMaskSurfacesMatchMeta passes for flat aligned lake surfaces
  - assertLakeMaskSurfacesMatchMeta rejects uneven lake cell elevations
  - assertLakeMaskSurfacesMatchMeta rejects surfaces diverging from lakeMeta
  - assertLakeMaskSurfacesMatchMeta maps spill-adjacent components to lake records
  - assertLakeMaskSurfacesMatchMeta rejects unmapped lake-mask components

### `world-builder/core/hydrology/priorityFloodFill.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** priorityFloodFill raises a single pit to the lowest spill elevation; +3 additional cases
- **Cases:**
  - priorityFloodFill raises a single pit to the lowest spill elevation
  - priorityFloodFill fills nested pits toward the outer spill in order
  - priorityFloodFill drains plateau pits to the lowest reachable outlet
  - priorityFloodFill treats ocean cells as boundary outlets at sea level

### `world-builder/core/hydrology/refineRiverNetwork.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** refineRiverNetworkFromSketch is a no-op mask when sketch is empty; +4 additional cases
- **Cases:**
  - refineRiverNetworkFromSketch is a no-op mask when sketch is empty
  - refineRiverNetworkFromSketch collapses parallel sketch strands into one corridor
  - refineRiverNetworkFromSketch adds lateral deviation when meandering is enabled
  - refineRiverNetworkFromSketch carves river cells lower during settlement
  - branchKeepRatioForMergeStrength lowers branch retention as merge strength rises

### `world-builder/core/hydrology/riverCorridorDisplay.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 12
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - measurePhysicalRiverHalfWidth returns zero without measurable banks
  - measurePhysicalRiverHalfWidth measures incised trench half-width
  - smoothRiverCorridorMaskForDisplay keeps dense blocks and prunes sparse cells
  - buildPhysicalRiverCorridorMask paints only centerline for headwaters on flat terrain
  - buildPhysicalRiverCorridorMask fills incised trunk cross-section
  - buildPhysicalRiverCorridorMask keeps centerline width at ocean and lake shores
  - capRiverCorridorRadiusAtWaterEdge zeroes radius beside water
  - capRiverCorridorRadiusAtWaterEdge zeroes radius when downstream is ocean
  - flowPerpendicularStep returns integer perpendicular for diagonal flow
  - default seed generation paints wider rivers than centerline mask alone
  - buildPhysicalRiverCorridorMask paints corridor from centerline and flow direction
  - default seed generation exposes channel width for navigable graph metrics

### `world-builder/core/hydrology/riverMaskLifecycle.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 23
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance; River mask lifecycle substep integration; Contract derivation or selector wiring
- **Cases:**
  - routeFractalCorridorPath connects endpoints on a low saddle
  - routeFractalCorridorPath returns null when descent is required but path climbs
  - routeFractalCorridorPath meander refine profile stays near sketch mask
  - findLeastResistancePath returns null when downhill-only routing is blocked
  - RIVER_MASK_LIFECYCLE_ORDER documents sketch through painted stages
  - mask lifecycle snapshots follow sketch→incised→settled→presentation→painted order
  - skipRefine transition copies settled mask to presentation when refine is skipped
  - enableMeanderRefine changes presentation mask but leaves simulationRiverMask byte-equal
  - riverAttractionRadiusScale changes presentation only and leaves simulationRiverMask byte-equal
  - simulationRiverMask resolves from settled stage via public pipeline API
  - resolveDisplayRiverNetworkMask prefers presentation over settled
  - applySkipRefineTransition copies settled mask to presentation
  - applySkipRefineToPipeline copies settled mask to presentation
  - resolveDisplayRiverNetworkMaskFromPipeline prefers presentation over settled
  - resolveSimulationRiverNetworkMaskFromPipeline returns settled regardless of presentation
  - resolveSimulationRiverNetworkMaskFromPipeline throws when settled stage is missing
  - snapshotRiverMaskPipeline captures mask fields by stage
  - snapshotRiverMaskLifecycle captures mask fields by stage
  - getRiverMaskStageFromContext reads pipeline stage from hydrology context
  - requireRiverMaskStageFromContext throws when stage is missing
  - requireRiverMaskStage returns a present stage from the pipeline
  - requireRiverMaskStage throws when stage is missing
  - riverMaskContractKey names pipeline stages for substep contracts

### `world-builder/core/hydrology/riverNetwork.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 13
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - selectCoastalMouths keeps the largest discharge within merge radius
  - traceRiverUpstream marks tributaries above a mouth
  - isRiverHeadwaterOnCenterline identifies source cells on the centerline
  - traceRiverChainSegments emits headwater-to-junction chains
  - buildRiverNetworkMask routes lake overflow outlets downstream
  - isRiverHeadwaterOnDrainageField matches drainage-field upstream count
  - isRiverJunctionOnDrainageField detects confluences on the drainage field
  - isRiverMouthDrainageCell requires ocean downstream
  - buildNavigableRiverMask marks cells along graph edges
  - assembleRiverNetworkFromFields prefers persisted centerline over graph edge cells
  - assembleRiverNetworkFromValidationSlice assembles contract from slice fields
  - assembleRiverNetwork and readRiverNetworkFromWorldDocument round-trip contract fields
  - painted corridor and renderer overlay agree on visible river cells

### `world-builder/core/hydrology/riverNetworkLegacyMeanders.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** RIVER_LEGACY_MEANDER_STAGES maps heuristics to hydrology substeps; +5 additional cases
- **Cases:**
  - RIVER_LEGACY_MEANDER_STAGES maps heuristics to hydrology substeps
  - isCorridorAttractionEnabled is false when radius scale is zero
  - isMeanderRefineEnabled follows enableMeanderRefine option
  - DEFAULT_WORLD_GENERATION_OPTIONS disables corridor attraction (Option A)
  - applyPresentationStageCorridorAttraction is a no-op when radius scale is zero
  - applyRefineStageMeanderPresentation returns empty mask for empty sketch

### `world-builder/core/hydrology/riverPathfinding.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** unitVector and normalizeVector return unit-length directions; +5 additional cases
- **Cases:**
  - unitVector and normalizeVector return unit-length directions
  - angleDegrees measures turn between path segments
  - findLeastResistancePath routes around a hill between endpoints
  - findLeastResistancePath accepts preferredArrivalDir without blocking reachability
  - findLeastResistancePath returns null when destination is unreachable
  - findLeastResistancePath stops searching after the visit budget on large grids

### `world-builder/core/hydrology/seasonalBiomeDrift.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance
- **Cases:**
  - deriveAnnualMeanClimate causes no biome drift at 25 simulation years with extreme season multipliers
  - deriveAnnualMeanClimate causes no biome drift at default options regardless of year count
  - seasonal biome influence scale blends toward season-weighted climate

### `world-builder/core/hydrology/seasonalClimatology.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** SEASON_ORDER cycles through four seasons; +7 additional cases
- **Cases:**
  - SEASON_ORDER cycles through four seasons
  - deriveYearlyClimateNoise is reproducible and varies by year
  - seasonRainfallMultiplier scales wet season by year multiplier
  - computeSeasonalRunoff wet exceeds dry on the same cell
  - deriveAnnualMeanClimate returns copies of base fields when influence scale is zero
  - deriveAnnualMeanClimate applies season weights at full influence scale
  - computeSeasonalSnowAccum scales cap accumulation by the wind factor
  - accumulateEffectiveRunoff tracks peak wet and melt runoff

### `world-builder/core/hydrology/seededTemporaryRiverCarve.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - selectTemporaryRiverSources picks high slope×area cells deterministically
  - routeDownslopePath follows steepest descent on filled DEM
  - carveTemporaryRivers lowers corridor cells below pre-carve neighbors along path
  - carveTemporaryRivers reports fractional progress
  - carveTemporaryRivers applies stream-power after corridor carve
  - carveTemporaryRivers uses channelSeedMask when provided

### `world-builder/core/hydrology/settleLakeEquilibrium.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Layer refresh locality; Seed determinism
- **Cases:**
  - settleLakeEquilibrium normalizes disturbed endorheic lake surfaces
  - settleLakeEquilibrium keeps endorheic basins closed after disturbance
  - settleLakeEquilibrium preserves breached outlet connectivity
  - settleLakeEquilibrium refreshes ocean spill coordinates after rim disturbance
  - settleLakeEquilibrium matches lake records when breach shifts lake ids
  - settleLakeEquilibrium output passes lake display coherence checks
  - settleLakeEquilibrium is deterministic on fixed grids

### `world-builder/core/hydrology/simulateSeasonalHydrology.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulateSeasonalHydrology can overtop a closed basin under heavy wet years; +3 additional cases
- **Cases:**
  - simulateSeasonalHydrology can overtop a closed basin under heavy wet years
  - simulateSeasonalHydrology never raises lake surface above spill elevation
  - simulateSeasonalHydrology routes wind-biased snow melt to leeward cap outlets
  - simulateSeasonalHydrology dry evaporation can keep endorheic lakes below spill

### `world-builder/core/hydrology/snowWindEffects.test.js`

- **Seam:** `hydrology-unit` — Hydrology algorithm module
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeSnowWindAccumFactor favors leeward cap cells over windward edges; +2 additional cases
- **Cases:**
  - computeSnowWindAccumFactor favors leeward cap cells over windward edges
  - computeSnowWindAccumFactor leaves non-cap cells at unity
  - snowMeltOutletCell returns the steepest downhill non-cap neighbor

### `world-builder/core/landmassPipelineStageContracts.test.js`

- **Seam:** `landmass-contract` — Stage input/output contract derivation
- **Test count:** 16
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics; Contract derivation or selector wiring; Layer refresh locality; Seed determinism
- **Cases:**
  - LANDMASS_PIPELINE_STEP_IDS matches derived geography stage order
  - each landmass stage contract declares narrow input and output keys
  - pickLandmassStageInput rejects erosion without physical terrain baseline
  - pickLandmassStageInput rejects hydrology without erosion
  - pickLandmassStageInput rejects field refresh without hydrology outputs
  - pickLandmassStageInput rejects coast and resources before field refresh
  - pickLandmassStageInput rejects validation before coast and resources
  - pickLandmassStageInput returns only contract input keys for each stage
  - assertLandmassStageOutputs rejects missing erosion output at seam
  - assertLandmassStageOutputs rejects missing hydrology output at seam
  - assertLandmassStageOutputs rejects missing validation output at seam
  - assertLandmassStageOutputs rejects missing physical terrain baseline output at seam
  - assertLandmassStageOutputs rejects missing coast and resources output at seam
  - buildPipelineStateForHydrologySubsteps seeds minimal erosion-complete state
  - runPipelineStep asserts contracted outputs after erosion, hydrology, and validation
  - runPipelineStep hydrology cancellation throws LandmassPipelineCancelledError

### `world-builder/core/landmassPipelineTypes.test.js`

- **Seam:** `landmass-contract` — Stage input/output contract derivation
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - LANDMASS_PIPELINE_STEP_IDS is defined in the neutral types module
  - LandmassPipelineCancelledError carries pipeline state for finalize
  - isLandmassPipelineCancelledError recognizes unified cancellation errors

### `world-builder/core/nodePlacementBounds.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** isNodePlacementCellAllowed rejects cells within the map edge margin; +1 additional cases
- **Cases:**
  - isNodePlacementCellAllowed rejects cells within the map edge margin
  - isNodePlacementCellAllowed rejects all cells when the map is too small

### `world-builder/core/noise/valueNoise2d.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - sampleValueNoise2d is deterministic for the same coordinates and seed
  - sampleValueNoise2d returns values in [0, 1]
  - sampleValueNoise2d matches legacy fbm2d lattice sampling

### `world-builder/core/resourcePlacementScaling.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** strategicResourceNodeSpacingForGrid matches reference spacing at 256²; +5 additional cases
- **Cases:**
  - strategicResourceNodeSpacingForGrid matches reference spacing at 256²
  - strategicResourceNodeSpacingForGrid scales linearly to 1024²
  - saltLandProximityRadiusForGrid matches reference radius at 256²
  - saltLandProximityRadiusForGrid scales linearly to 1024²
  - coastalProximityMaxDistanceForGrid matches reference distance at 256²
  - coastalProximityMaxDistanceForGrid scales linearly to 1024²

### `world-builder/core/resources/computeMetalsRaster.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - computeMetalsRaster returns a grid-sized Float32Array with values in [0, 1]
  - computeMetalsRaster scores mountain and hills cells higher than grassland
  - computeMetalsRaster boosts upland river-headwater proxies
  - computeMetalsRaster is deterministic for the same inputs

### `world-builder/core/resources/generateArableRaster.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateArableRaster returns grid-sized values in [0, 1]
  - generateArableRaster zeros cells at or below minimumProductivity
  - generateArableRaster is deterministic for same geography seed
  - generateArableRaster favors temperate wet river-adjacent cells over mountain desert
  - generateArableRaster zeros ocean cells
  - generateArableRaster boosts trunk channel cells over tributary-only neighbors
  - generateArableRaster preserves golden checksums for representative seeds

### `world-builder/core/resources/generateTimberProductivity.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - generateTimberProductivity returns raster matching grid with values in [0, 1]
  - generateTimberProductivity is deterministic for fixed geography seed
  - generateTimberProductivity is higher on forest biomes than tundra glacier and desert
  - generateTimberProductivity suppresses timber above treeline proxy elevation and temperature

### `world-builder/core/resources/placeMetalNodes.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - placeMetalNodes returns stable ids and coordinates from raster peaks
  - placeMetalNodes is deterministic for a fixed seed
  - placeMetalNodes enforces minimum spacing between selected nodes
  - placeMetalNodes returns no nodes when maxNodes is zero
  - placeMetalNodes respects maxNodes cap
  - placeMetalNodes excludes candidates within the map edge margin

### `world-builder/core/resources/placeSaltNodes.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** measureLandBiomeFractionWithinRadius counts a 10-cell disk; +8 additional cases
- **Cases:**
  - measureLandBiomeFractionWithinRadius counts a 10-cell disk
  - measureLandBiomeFractionWithinRadius scales disk area with grid-scaled radius
  - saltNodeHasSubstantialLandProximity rejects a lone land hot pixel in open ocean
  - saltNodeHasSubstantialLandProximity accepts shoreline-style half land cover
  - placeSaltNodes excludes candidates within the map edge margin
  - placeSaltNodes rejects open-ocean river corridor nodes surrounded by water
  - placeSaltNodes rejects embayed nodes with only a sliver of nearby land
  - placeSaltNodes prefers shoreline candidates over inland cells with equal salinity
  - placeSaltNodes keeps coastal candidates with substantial neighboring land

### `world-builder/core/runLandmassPipeline.test.js`

- **Seam:** `landmass-pipeline` — Derived geography pipeline orchestration
- **Test count:** 22
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Typed array / graph clone independence; Pipeline cancellation semantics; Seed determinism
- **Cases:**
  - shouldAttachLandmassStepPreview is false for intermediate steps by default
  - shouldAttachLandmassStepPreview honors enableIntermediateStepPreviews
  - runLandmassPipeline completes with success status and world document
  - runLandmassPipeline matches runFullDerivedGeographyPipeline output
  - runLandmassPipeline omits world document on intermediate step-complete by default
  - runLandmassPipeline includes previews on every step when enabled
  - runLandmassPipeline returns cancelled when shouldCancel is true before start
  - runLandmassPipeline returns cancelled when shouldCancel fires mid-pipeline
  - runLandmassPipeline returns error status when a callback throws
  - runLandmassPipeline distinguishes success, exhausted, cancelled, and error terminal statuses
  - runLandmassPipelineRun distinguishes success, exhausted, cancelled, and error terminal statuses
  - runLandmassPipeline returns exhausted when validation retries are exhausted
  - runLandmassPipeline exhausted world document is cloneable for map display
  - runLandmassPipeline retries validation with incremented seed
  - runLandmassPipeline returns cancelled when hydrology aborts due to shouldCancel
  - runLandmassPipelineRun matches runLandmassPipeline output through shared runner
  - runLandmassPipelineRun returns cancelled when shouldCancel fires mid-pipeline
  - runLandmassPipeline forwards onSubstepPrepare through hydrology step
  - runLandmassPipelineRun forwards onSubstepPrepare through hydrology step
  - runLandmassPipelineRun returns cancelled when hydrology aborts due to shouldCancel
  - runLandmassPipelineRun returns exhausted when validation retries are exhausted
  - runLandmassPipelineRun retries validation with incremented seed

### `world-builder/core/validation/computeHydrologyMetrics.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance
- **Cases:**
  - computeHydrologyMetrics uses riverNetwork.centerline only
  - computeHydrologyMetrics requires riverNetwork.centerline
  - computeHydrologyMetrics counts river cells from network centerline
  - computeHydrologyMetrics estimates Hack law exponent on synthetic trunk
  - computeHydrologyMetrics detects parallel strand overlap
  - computeHydrologyMetrics measures coast-connected navigable path length
  - computeHydrologyMetrics counts only navigable graph edges
  - computeHydrologyMetrics returns null Hack exponent without navigable trunk samples
  - computeHydrologyMetrics slope-area concavity preserves golden checksum on default simulation path

### `world-builder/core/validation/computeResourceValidationMetrics.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeArableEnvelopeMetrics counts productive land cells from arable raster; +7 additional cases
- **Cases:**
  - computeArableEnvelopeMetrics counts productive land cells from arable raster
  - computeArableEnvelopeMetrics excludes ocean cells from land fraction
  - findSaltNodeLandProximityViolations flags ocean-adjacent salt nodes
  - findSaltNodeLandProximityViolations accepts shoreline-style land cover
  - findStrategicResourceSpacingViolations flags nodes closer than grid-scaled spacing
  - findStrategicResourceSpacingViolations ignores cross-type pairs
  - MIN_ARABLE_LAND_FRACTION is a small but non-zero envelope floor
  - makeResourceWorldFixture documents known arable envelope layout

### `world-builder/core/validation/computeWindRainfallAsymmetry.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeWindRainfallAsymmetry reports a positive gap when the windward flank is w; +2 additional cases
- **Cases:**
  - computeWindRainfallAsymmetry reports a positive gap when the windward flank is wetter
  - computeWindRainfallAsymmetry flips sign when the wind reverses
  - computeWindRainfallAsymmetry returns zero when no highland cells exist

### `world-builder/core/validation/elevationPriorPassRates.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - countRiverValidationPasses returns tallies for each seed in batch
  - elevation priors keep navigable river pass rate high on default seed batch
  - seed 4 gains coast mouth with elevation priors on validation grid
  - advisory validation mode never rejects default seed batch candidates

### `world-builder/core/validation/landmassValidationContracts.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 11
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - VALIDATION_CHECK_IDS lists every contract in stable order
  - rejectable and advisory check ids partition the contract
  - readEnforceFlag maps rejectable checks to enforce options
  - resolveValidationCheckStatus warns for advisory failures
  - resolveValidationCheckStatus fails rejectable checks only when enforced
  - isRejectionSamplingEnforced is false when all enforce flags are off
  - isRejectionSamplingEnforced is true when any rejectable check is enforced
  - collectStructuredRejectionReasons returns check ids and categories only
  - createValidationRow copies category and rejectable from contract
  - resource validation contracts document advisory vs rejectable behavior
  - buildValidationSignals exposes logistics-facing movement metrics

### `world-builder/core/validation/runGeographyValidationChecks.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 21
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - runGeographyValidationChecks resolves river metrics from assembled contract
  - runGeographyValidationChecks returns all check ids
  - runGeographyValidationChecks marks rejectable rows from contract
  - runGeographyValidationChecks warns on missing navigable rivers
  - runGeographyValidationChecks hard-fails navigableRiverQuota when enforced
  - runGeographyValidationChecks ignores non-navigable edges for navigableRiverQuota
  - runGeographyValidationChecks passes with sufficient navigable edges
  - runGeographyValidationChecks hard-fails coastMouth when enforced
  - runGeographyValidationChecks enforces endorheic fraction cap from breach threshold
  - runGeographyValidationChecks detects resource mismatch
  - runGeographyValidationChecks reports identifiable metric names for empty graph
  - runGeographyValidationChecks hard-fails parallelStrandRatio when enforced
  - runGeographyValidationChecks hard-fails hacksLawExponent when enforced and unavailable
  - runGeographyValidationChecks hard-fails slopeAreaConcavity when enforced and unavailable
  - runGeographyValidationChecks hard-fails hacksLawExponent when enforced and out of bounds
  - runGeographyValidationChecks hard-fails coastConnectedNavigablePath when enforced and short
  - maxEndorheicFractionForOptions uses explicit cap when finite
  - maxEndorheicFractionForOptions derives cap from breach threshold when unset
  - runGeographyValidationChecks passes salinityOceanGradient for canonical ocean-inland field
  - runGeographyValidationChecks warns on flat salinity without ocean gradient
  - runGeographyValidationChecks evaluates resource outputs from world document fixture

### `world-builder/core/validation/runResourceValidationChecks.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** runResourceValidationChecks returns resource check ids in stable order; +7 additional cases
- **Cases:**
  - runResourceValidationChecks returns resource check ids in stable order
  - runResourceValidationChecks passes arable envelope for productive land layout
  - runResourceValidationChecks warns on thin arable envelope
  - runResourceValidationChecks warns on salt node land proximity violations
  - runResourceValidationChecks hard-fails saltNodeLandProximity when enforced
  - runResourceValidationChecks warns on strategic resource spacing violations
  - runResourceValidationChecks hard-fails strategicResourceSpacing when enforced
  - runResourceValidationChecks skips unavailable resource outputs with pass rows

### `world-builder/core/validation/shouldRejectGeographyCandidate.test.js`

- **Seam:** `validation-unit` — Generation report and rejection checks
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** shouldRejectGeographyCandidate is false when only warnings present; +5 additional cases
- **Cases:**
  - shouldRejectGeographyCandidate is false when only warnings present
  - shouldRejectGeographyCandidate is true when a hard fail row exists
  - collectStructuredRejectionReasons returns check ids without summaries
  - collectRejectionReasons preserves legacy string reasons for logging
  - rejection sampling disabled mode never rejects from advisory-only failures
  - rejection sampling enforced mode rejects on configured hard failures

### `world-builder/core/windClimateIntegration.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** rotating prevailing wind shifts rainfall, biomes, and rivers end to end
- **Cases:**
  - rotating prevailing wind shifts rainfall, biomes, and rivers end to end

### `world-builder/core/worldGenerationOptions.test.js`

- **Seam:** `core-unit` — Core geography algorithm
- **Test count:** 14
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** DEFAULT_WORLD_GENERATION_OPTIONS documents breachThreshold default; +13 additional cases
- **Cases:**
  - DEFAULT_WORLD_GENERATION_OPTIONS documents breachThreshold default
  - resolveWorldGenerationOptions preserves breachThreshold default
  - resolveWorldGenerationOptions merges partial breachThreshold override
  - resolveWorldGenerationOptions preserves stream-power incision defaults
  - resolveWorldGenerationOptions preserves hydrology validation defaults
  - resolveWorldGenerationOptions preserves maxValidationRetries default
  - resolveWorldGenerationOptions defaults legacy presentation heuristics off (issue #345 Option A)
  - resolveWorldGenerationOptions merges enableMeanderRefine override
  - resolveWorldGenerationOptions merges riverAttractionRadiusScale for presentation opt-in
  - resolveWorldGenerationOptions preserves rainfall amount default
  - resolveWorldGenerationOptions merges biomeEdgeNoiseStrength override
  - resolveWorldGenerationOptions merges rainfallAmountScale override
  - resolveWorldGenerationOptions preserves seasonal hydrology defaults
  - resolveWorldGenerationOptions merges enableSeasonalHydrology override

### `world-builder/formatPrevailingWind.test.js`

- **Seam:** `world-builder-unit` — Top-level world-builder module
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** normalizeWindDegreesForDisplay wraps to 0-359; +2 additional cases
- **Cases:**
  - normalizeWindDegreesForDisplay wraps to 0-359
  - formatCardinalWindDirection maps cardinal bearings
  - formatPrevailingWindDisplay includes degrees and label

### `world-builder/renderer/biomeIndicesToRgba.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** biomeIndicesToRgba returns RGBA buffer sized width*height*4
- **Cases:**
  - biomeIndicesToRgba returns RGBA buffer sized width*height*4

### `world-builder/renderer/buildArableOverlayCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildArableOverlayRgba returns null when raster is absent; +5 additional cases
- **Cases:**
  - buildArableOverlayRgba returns null when raster is absent
  - buildArableOverlayRgba encodes arable strength as alpha via shared raster style
  - buildArableOverlayRgba omits cells below minimumProductivity
  - buildArableOverlayRgba returns null when minimumProductivity filters all signal
  - buildArableOverlayCanvas returns sized canvas when raster has signal
  - buildArableOverlayCanvas rasterizes RGBA only once

### `world-builder/renderer/buildLakeOverlayCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 6
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildLakeOverlayRgba returns null when lakeMask is missing or empty; +5 additional cases
- **Cases:**
  - buildLakeOverlayRgba returns null when lakeMask is missing or empty
  - buildLakeOverlayRgba fills lake cells with semi-transparent blue
  - buildLakeOverlayRgba uses one rgba buffer for large connected lake regions
  - buildLakeOverlayCanvas returns null when lakeMask has no lake cells
  - buildLakeOverlayCanvas returns sized canvas for lake cells
  - buildLakeOverlayCanvas throws when canvas context is unavailable

### `world-builder/renderer/buildLandTerrainRgba.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - buildLandTerrainRgba uses display biomes without reclassifying river cells
  - buildLandTerrainRgba matches Option A default-seed river-corridor land tint

### `world-builder/renderer/buildMetalsOverlayCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildMetalsOverlayCanvas returns null when metals raster is empty; +3 additional cases
- **Cases:**
  - buildMetalsOverlayCanvas returns null when metals raster is empty
  - buildMetalsOverlayCanvas returns canvas matching grid dimensions
  - buildMetalsOverlayCanvas rasterizes RGBA only once
  - metals raster overlay style uses hatch encoding distinct from arable

### `world-builder/renderer/buildResourceRasterOverlayRgba.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch ba; +8 additional cases
- **Cases:**
  - resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch bands
  - resourceRasterHatchFactor honors custom spacing and line width
  - buildResourceRasterOverlayRgba returns null when raster has no positive productivity
  - buildResourceRasterOverlayRgba encodes productivity as alpha with style rgb
  - buildResourceRasterOverlayRgba omits cells below minimumProductivity
  - hasDrawableResourceRasterOverlayPixels matches buildResourceRasterOverlayRgba nullability
  - hasDrawableResourceRasterOverlayPixels honors minimumProductivity like RGBA builder
  - buildResourceRasterOverlayRgba increments seam build counter
  - buildResourceRasterOverlayRgba applies hatch mask for metals style

### `world-builder/renderer/buildRiverOverlayCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring
- **Cases:**
  - buildRiverOverlayRgba reads painted corridor from river-network contract
  - buildRiverOverlayRgba returns null without river-network contract
  - buildRiverOverlayRgba returns null when contract corridor is empty
  - buildRiverOverlayRgba paints outline pixels beside contracted corridor
  - buildRiverOverlayRgba ignores biome-painted rivers without contract

### `world-builder/renderer/buildTimberOverlayCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildTimberOverlayRgba returns null when raster is absent; +2 additional cases
- **Cases:**
  - buildTimberOverlayRgba returns null when raster is absent
  - buildTimberOverlayCanvas returns sized canvas when raster has signal
  - buildTimberOverlayCanvas rasterizes RGBA only once

### `world-builder/renderer/buildTopographyContourCanvas.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** buildTopographyContourCanvas returns null for flat submerged terrain; +2 additional cases
- **Cases:**
  - buildTopographyContourCanvas returns null for flat submerged terrain
  - buildTopographyContourCanvas throws when canvas context is unavailable
  - buildTopographyContourCanvas returns sized canvas for elevated land

### `world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js`

- **Seam:** `viewport-behavior` — Map viewport layer sync and framing
- **Test count:** 6
- **Skip conditions:** May require --experimental-test-module-mocks in npm test (#369)
- **Behaviors:** updateWorldDocument preserves overlay render cache set by syncOverlayRenderCache; +5 additional cases
- **Cases:**
  - updateWorldDocument preserves overlay render cache set by syncOverlayRenderCache
  - updateWorldDocument resizes viewport to the new world document dimensions
  - updateWorldDocument rasterizes each visible resource layer at most once
  - updateWorldDocument with changedLayers skips unchanged visible resource layers
  - overlay owner seam toggles timber on displayed document without rebuilding arable
  - updateWorldDocument syncs viewport dimensions without refitting to world

### `world-builder/renderer/createWorldBuilderMapViewport.layers.test.js`

- **Seam:** `viewport-behavior` — Map viewport layer sync and framing
- **Test count:** 2
- **Skip conditions:** May require --experimental-test-module-mocks in npm test (#369)
- **Behaviors:** viewport layer stack follows terrain contours arable timber metals lakes rivers ; +1 additional cases
- **Cases:**
  - viewport layer stack follows terrain contours arable timber metals lakes rivers order
  - lake overlay rasterizes from lakeMask rather than per-cell vector rects

### `world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js`

- **Seam:** `viewport-behavior` — Map viewport layer sync and framing
- **Test count:** 9
- **Skip conditions:** May require --experimental-test-module-mocks in npm test (#369)
- **Behaviors:** Layer refresh locality
- **Cases:**
  - syncOverlayRenderCache projects owner overlay state in one refresh pass
  - syncOverlayRenderCache hiding one overlay leaves other resource rasters unrebuilt
  - syncOverlayRenderCache re-committing identical overlay state rebuilds no resource rasters
  - syncOverlayRenderCache showing metals rebuilds only metals while other rasters stay visible
  - syncOverlayRenderCache rebuilds only arable when the envelope threshold changes
  - syncOverlayRenderCache toggling salt nodes never rebuilds resource rasters
  - viewport exposes only the single overlay owner seam, not per-overlay mutators
  - viewport init skips resource rasterization while overlays are hidden
  - overlay owner seam rasterizes a resource layer at most once per toggle

### `world-builder/renderer/createWorldBuilderMapViewport.overlayVisibility.test.js`

- **Seam:** `viewport-behavior` — Map viewport layer sync and framing
- **Test count:** 7
- **Skip conditions:** May require --experimental-test-module-mocks in npm test (#369)
- **Behaviors:** Typed array / graph clone independence
- **Cases:**
  - overlay owner seam hides salt markers by default and shows them when enabled
  - overlay owner seam hides arable raster by default and shows it when enabled
  - overlay owner seam redraws arable overlay when the envelope threshold changes
  - overlay owner seam hides timber raster by default and shows it when enabled
  - overlay owner seam can show arable and timber overlays together independently
  - overlay owner seam can show salt and timber overlays together
  - overlay owner seam toggles metals hatch raster and mine markers together

### `world-builder/renderer/createWorldBuilderMapViewport.viewportFraming.test.js`

- **Seam:** `viewport-behavior` — Map viewport layer sync and framing
- **Test count:** 4
- **Skip conditions:** May require --experimental-test-module-mocks in npm test (#369)
- **Behaviors:** focusOn uses current world document width after regeneration; +3 additional cases
- **Cases:**
  - focusOn uses current world document width after regeneration
  - initial mount fits viewport to world bounds once
  - ResizeObserver syncs host dimensions without refitting after initial mount
  - fitToWorld explicitly refits viewport to current world document

### `world-builder/renderer/diffResourceOverlayMapLayers.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** toggling timber visibility changes only the timber raster layer; +6 additional cases
- **Cases:**
  - toggling timber visibility changes only the timber raster layer
  - toggling metals visibility changes the metals raster and the vector node layer
  - toggling salt visibility changes only the vector node layer
  - toggling arable visibility changes only the arable raster layer
  - changing the arable envelope threshold changes only the arable raster layer
  - an unchanged overlay commit changes no layers
  - independent overlay changes union into the affected layers only

### `world-builder/renderer/diffWorldDocumentMapLayers.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Typed array / graph clone independence
- **Cases:**
  - diffWorldDocumentMapLayers returns null without a previous document
  - diffWorldDocumentMapLayers returns null when grid dimensions change
  - diffWorldDocumentMapLayers returns empty when documents share layer inputs
  - diffWorldDocumentMapLayers detects terrain and contour changes independently
  - diffWorldDocumentMapLayers detects resource raster changes only for affected layers
  - diffWorldDocumentMapLayers detects hydrology and lake mask changes
  - diffWorldDocumentMapLayers detects vector overlay node changes

### `world-builder/renderer/extractTopographyContourSegments.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Seed determinism
- **Cases:**
  - extractTopographyContourSegments returns no segments for flat ocean
  - extractTopographyContourSegments traces contours around elevated land
  - extractTopographyContourSegments is deterministic for the same field

### `world-builder/renderer/mapLayerRefresh.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 7
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Layer refresh locality
- **Cases:**
  - isFullMapLayerRefresh treats null and undefined as full rebuild
  - isFullMapLayerRefresh treats an explicit changed-layer set as partial rebuild
  - shouldRefreshMapLayer refreshes every layer on full rebuild
  - shouldRefreshMapLayer refreshes only listed layers on partial rebuild
  - createMapLayerRefreshRunner invokes every handler on full rebuild
  - createMapLayerRefreshRunner invokes only changed handlers on partial rebuild
  - createMapLayerRefreshRunner hides unrefreshed layers when requested

### `world-builder/renderer/rendererSeamContract.test.js`

- **Seam:** `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** simulationRiverMask population or invariance
- **Cases:**
  - terrain tint reads displayBiomes, not the simulation biome classification
  - terrain tint is invariant to simulation biomes when displayBiomes is unchanged
  - biomeIndicesToRgba and buildLandTerrainRgba agree on the displayBiomes palette
  - terrain raster applies no edge smoothing across river-corridor boundaries
  - river overlay draws from the presentation corridor mask, ignoring biome-painted rivers

### `world-builder/renderer/resourceOverlayVisibility.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 15
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** createDefaultResourceOverlayVisibility defaults salt overlay off; +14 additional cases
- **Cases:**
  - createDefaultResourceOverlayVisibility defaults salt overlay off
  - applyResourceOverlayVisibility toggles a resource without mutating prior state
  - isResourceOverlayVisible treats unknown resources as hidden
  - shouldDrawResourceNodeOverlay hides salt markers by default
  - shouldDrawResourceNodeOverlay draws salt markers when overlay is on
  - shouldDrawResourceRasterOverlay hides timber raster by default
  - shouldDrawResourceRasterOverlay draws timber raster when overlay is on
  - shouldDrawResourceRasterOverlay skips all-zero rasters
  - shouldDrawResourceRasterOverlay hides arable raster by default
  - shouldDrawResourceRasterOverlay draws arable raster when overlay is on
  - shouldDrawResourceRasterOverlay hides metals raster by default
  - shouldDrawResourceRasterOverlay draws metals raster when overlay is on
  - shouldDrawResourceNodeOverlay hides metal mine markers by default
  - shouldDrawResourceNodeOverlay draws metal mine markers when overlay is on
  - metals rasterAndNodes overlay uses one visibility flag for raster and nodes

### `world-builder/renderer/resourceRasterOverlayRefresh.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Layer refresh locality
- **Cases:**
  - RESOURCE_RASTER_OVERLAY_LAYER_IDS lists raster overlay layers from definitions
  - isResourceRasterOverlayLayerId identifies raster layers only
  - resolveResourceRasterOverlaySpriteVisible does not rasterize overlay RGBA
  - resolveResourceRasterOverlaySpriteVisible respects arable minimum productivity without building RGBA
  - refreshResourceRasterOverlayCanvas performs at most one RGBA build per layer refresh
  - refreshAllResourceRasterOverlayCanvases rasterizes only visible layers once each
  - buildResourceRasterOverlayCanvasForId builds metals canvas with a single RGBA pass
  - buildResourceRasterOverlayRgba increments seam build counter

### `world-builder/renderer/resourceRasterOverlaySeamContract.test.js`

- **Seam:** `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition; +1 additional cases
- **Cases:**
  - RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition
  - registry resolves each raster overlay visibility without rasterizing RGBA

### `world-builder/renderer/resourceRasterOverlayStyles.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 3
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch ba; +2 additional cases
- **Cases:**
  - resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch bands
  - timber and arable raster overlay styles use distinct rgba encodings
  - buildResourceRasterOverlayRgba returns null when raster has no positive productivity

### `world-builder/renderer/smoothRiverBiomeEdgesInRgba.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** crispRiverEdgeStrength steepens mid-range alpha versus raw blur; +4 additional cases
- **Cases:**
  - crispRiverEdgeStrength steepens mid-range alpha versus raw blur
  - crispRiverEdgeStrength returns 0 below the smoothstep floor
  - crispRiverEdgeStrength returns 1 above the smoothstep ceiling
  - computeRiverOutlineMask marks land outside and water inside the feathered edge
  - smoothRiverBiomeEdgesInRgba feathers land beside river without dulling river cells

### `world-builder/renderer/worldBuilderMapViewportModel.test.js`

- **Seam:** `renderer-unit` — Renderer canvas and diff helpers
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** computeRegionFocusScale uses the active world width after regeneration; +7 additional cases
- **Cases:**
  - computeRegionFocusScale uses the active world width after regeneration
  - resolveResourceRasterLayerVisible hides timber raster by default
  - resolveResourceRasterLayerVisible shows timber raster when overlay is enabled
  - resolveArableRasterLayerVisible respects arable minimum productivity cutoff
  - resolveMetalsOverlayDrawn gates raster hatch and mine markers together
  - resolveResourceRasterLayerVisible does not call buildResourceRasterOverlayRgba
  - resolveArableRasterLayerVisible does not call buildResourceRasterOverlayRgba
  - resolveSaltNodeOverlayDrawn hides salt markers until overlay is enabled

### `world-builder/research/researchTranscriptAssets.test.js`

- **Seam:** `research-asset` — Research transcript asset integrity
- **Test count:** 5
- **Skip conditions:** Skips runtime scan paths listed in RUNTIME_SCAN_SKIP
- **Behaviors:** Layer refresh locality
- **Cases:**
  - root gitignore excludes bulk YouTube transcript artifacts
  - git index does not track bulk transcript .en.txt files
  - research README documents playlist provenance and refresh commands
  - transcript refresh script and directory scaffolding exist locally
  - runtime code does not import gitignored transcript files

### `world-builder/research/scripts/srt-to-transcript.test.js`

- **Seam:** `research-asset` — Research transcript asset integrity
- **Test count:** 1
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** srtToTranscript deduplicates rolling captions and strips music markers
- **Cases:**
  - srtToTranscript deduplicates rolling captions and strips music markers

### `world-builder/resourceOverlayState.test.js`

- **Seam:** `overlay-state` — Resource overlay visibility state machine
- **Test count:** 10
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** createResourceOverlayPageState defaults visibility off and uses persisted displa; +9 additional cases
- **Cases:**
  - createResourceOverlayPageState defaults visibility off and uses persisted display settings
  - toggleResourceOverlayVisibility updates page state immutably
  - resetResourceOverlayVisibilityState clears toggles without changing display settings
  - updateOverlayDisplaySetting updates persisted arable cutoff immutably
  - commitResourceOverlayState returns next state and syncs viewport when provided
  - commitResourceOverlayState skips viewport sync when viewport is absent
  - commitResourceOverlayState syncs slider display setting changes to viewport
  - commitResourceOverlayState syncs reset visibility to viewport
  - commitResourceOverlayState can re-project unchanged owner state to viewport
  - syncResourceOverlayStateToViewport pushes owner state to viewport render cache API

### `world-builder/resourceOverlayStateSeamContract.test.js`

- **Seam:** `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- **Test count:** 5
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** useWorldBuilderOverlayState seam routes toggle through syncOverlayRenderCache on; +4 additional cases
- **Cases:**
  - useWorldBuilderOverlayState seam routes toggle through syncOverlayRenderCache only
  - useWorldBuilderOverlayState seam routes resetVisibility through syncOverlayRenderCache only
  - useWorldBuilderOverlayState seam routes setDisplaySetting through syncOverlayRenderCache and persists once
  - useWorldBuilderOverlayState seam syncToViewport projects owner state when viewport becomes ready
  - useWorldBuilderOverlayState seam applyPersistedDefaults restores store defaults without Pinia dual-write

### `world-builder/resourceOverlays.test.js`

- **Seam:** `overlay-state` — Resource overlay visibility state machine
- **Test count:** 19
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** createResourceOverlayDefinitions lists canonical overlay ids and kinds; +18 additional cases
- **Cases:**
  - createResourceOverlayDefinitions lists canonical overlay ids and kinds
  - createResourceOverlayIds returns canonical overlay ids in order
  - createDefaultResourceOverlayVisibility defaults every canonical overlay off
  - createDefaultResourceOverlayVisibility accepts a subset of resource ids
  - createDefaultOverlayDisplaySettings matches generation arable threshold
  - applyResourceOverlayVisibility toggles a resource without mutating prior state
  - isResourceOverlayVisible treats unknown resources as hidden
  - shouldDrawResourceNodeOverlay hides salt markers by default
  - shouldDrawResourceNodeOverlay draws salt markers when overlay is on
  - shouldDrawResourceRasterOverlay hides timber raster by default
  - shouldDrawResourceRasterOverlay draws timber raster when overlay is on
  - shouldDrawResourceRasterOverlay skips all-zero rasters
  - shouldDrawResourceRasterOverlay hides arable raster by default
  - shouldDrawResourceRasterOverlay draws arable raster when overlay is on
  - shouldDrawResourceRasterOverlay hides metals raster by default
  - shouldDrawResourceRasterOverlay draws metals raster when overlay is on
  - shouldDrawResourceNodeOverlay hides metal mine markers by default
  - shouldDrawResourceNodeOverlay draws metal mine markers when overlay is on
  - metals overlay visibility gates raster hatch and mine markers together

### `world-builder/runDerivedGeographyInWorker.test.js`

- **Seam:** `worker-protocol` — Worker postMessage and clone round-trip
- **Test count:** 19
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - runDerivedGeographyInWorker posts start params to the worker
  - runDerivedGeographyInWorker forwards step-start messages to onStepStart
  - runDerivedGeographyInWorker forwards step-complete without requiring world document
  - runDerivedGeographyInWorker forwards validation step-complete with world document
  - runDerivedGeographyInWorker forwards hydrology substep-prepare callbacks
  - runDerivedGeographyInWorker forwards hydrology substep lifecycle callbacks
  - runDerivedGeographyInWorker forwards exhausted status with world document
  - runDerivedGeographyInWorker terminates worker and calls onComplete without world document
  - runDerivedGeographyInWorker forwards worker errors and terminates
  - runDerivedGeographyInWorker forwards worker cancellation callback
  - runDerivedGeographyInWorker cancel posts cancel and terminates worker
  - runDerivedGeographyInWorker cancel invokes onCancelled like worker cancelled message
  - runDerivedGeographyInWorker delivers onCancelled only once when cancel races worker ack
  - runDerivedGeographyInWorker delivers onCancelled only once when worker ack races client cancel
  - runDerivedGeographyInWorker ignores worker messages after client cancel
  - runDerivedGeographyInWorker ignores unknown worker message types
  - runDerivedGeographyInWorker forwards worker onerror and terminates
  - runDerivedGeographyInWorker uses fallback error text when onerror has no message
  - runDerivedGeographyInWorker throws when Worker is unavailable

### `world-builder/worker/derivedGeography.worker.test.js`

- **Seam:** `worker-protocol` — Worker postMessage and clone round-trip
- **Test count:** 13
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - worker job completes successfully through shared landmass pipeline runner
  - worker job reports cancelled when shouldCancel is set mid-run
  - worker job reports cancelled when hydrology substep cancellation is requested
  - worker job reports error when pipeline callback throws
  - worker job reports exhausted when validation retries are exhausted
  - worker job omits intermediate previews unless explicitly enabled
  - worker messaging posts slim step-complete payloads on success path
  - worker messaging posts cancelled terminal without pipeline state on step-complete
  - worker messaging posts slim payloads when hydrology cancellation is requested
  - worker messaging keeps step-complete slim when a callback throws
  - worker messaging forwards substep-prepare through hydrology
  - worker success terminal posts metadata-only complete after validation step-complete
  - worker exhausted terminal posts world document on exhausted not complete

### `world-builder/worker/derivedGeographyWorkerProtocol.test.js`

- **Seam:** `worker-protocol` — Worker postMessage and clone round-trip
- **Test count:** 14
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics; Contract derivation or selector wiring
- **Cases:**
  - toWorkerStepCompleteMessage omits pipeline state and keeps optional world document
  - toWorkerStepCompleteMessage omits worldDocument when preview is not attached
  - toWorkerSubstepPrepareMessage forwards hydrology contract input
  - terminal worker messages match completion contract
  - isSlimWorkerStepCompleteMessage rejects legacy step-complete payloads with pipeline state
  - toWorkerTerminalMessage maps pipeline run results to completion contract terminals
  - worker pipeline callbacks post slim step-complete payloads
  - worker pipeline callbacks forward substep-prepare for hydrology contract hooks
  - worker pipeline callbacks suppress messages after cancellation
  - isMapPreviewWorldDocumentDelivery accepts validation step-complete with world document
  - isMapPreviewWorldDocumentDelivery rejects step-complete without world document
  - isMapPreviewWorldDocumentDelivery rejects non-validation step-complete even with world document
  - isMapPreviewWorldDocumentDelivery accepts exhausted terminal with world document
  - isMapPreviewWorldDocumentDelivery rejects exhausted terminal without world document

### `world-builder/worldBuilder.integration.test.js`

- **Seam:** `e2e-integration` — Full pipeline smoke without internal mocks
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** world builder route is a MainLayout child; +8 additional cases
- **Cases:**
  - world builder route is a MainLayout child
  - world builder route is not under ProjectShellLayout
  - world builder share catalog row is paste-unfurl eligible
  - generation control catalog exposes unique stable test ids
  - generation control catalog wires stream-power and hydrology knobs by key
  - default controls state builds worker-ready derived geography params
  - status bar helpers never show progress and overlay bar together
  - validation exhausted indicator test id is wired to exhausted-only presentation helpers
  - generateDerivedGeography on tiny grid completes landmass pipeline outputs

### `world-builder/worldBuilderGenerationCancel.test.js`

- **Seam:** `generation-orchestration` — Progress, cancel, and policy modules
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - unmount via dispose leaves run phase cancelled
  - supersede via regenerate stays running and clears stale progress callbacks
  - supersede ignores stale onComplete from superseded run
  - dispose delivers onCancelled once when worker bridge dedups cancel and ack

### `world-builder/worldBuilderGenerationMapLifecycle.test.js`

- **Seam:** `generation-orchestration` — Progress, cancel, and policy modules
- **Test count:** 9
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** concurrent applyWorldDocument calls create viewport only once; +8 additional cases
- **Cases:**
  - concurrent applyWorldDocument calls create viewport only once
  - sequential applyWorldDocument updates without recreating viewport
  - applyWorldDocument no-ops when map host or factory is unavailable
  - destroy clears viewport and in-flight init
  - destroy during in-flight init discards completed viewport
  - applyWorldDocument no-ops after destroy
  - onViewportReady runs once after first viewport create
  - applyWorldDocument forwards changedLayers from upstream layer diff
  - applyWorldDocument omits changedLayers when grid dimensions change

### `world-builder/worldBuilderGenerationOrchestrator.test.js`

- **Seam:** `generation-orchestration` — Progress, cancel, and policy modules
- **Test count:** 18
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - createInitialGenerationProgress starts idle before any pipeline step
  - reduceGenerationProgressOnStepStart advances active step and percent
  - reduceGenerationProgressOnSubstepStart tracks active hydrology substep
  - reduceGenerationProgressOnSubstepComplete records skipped hydrology substeps
  - reduceGenerationProgressOnStepComplete marks completed step index
  - createGenerationRunController invalidates stale runs when a new run begins
  - startDerivedGeographyGeneration skips map preview when step-complete has no world document
  - startDerivedGeographyGeneration forwards lifecycle callbacks for a successful run
  - startDerivedGeographyGeneration updates progress from slim step-complete payloads
  - startDerivedGeographyGeneration forwards exhausted lifecycle without treating as clean success
  - startDerivedGeographyGeneration ignores callbacks from stale runs
  - startDerivedGeographyGeneration rejects ineligible step-complete previews for non-validation steps
  - startDerivedGeographyGeneration does not push world document on metadata-only terminals
  - startDerivedGeographyGeneration applies preview policy from generation policy module
  - startDerivedGeographyGeneration cancels the previous active worker job
  - startDerivedGeographyGeneration cancelActive invokes onCancelled once
  - startDerivedGeographyGeneration ignores stale onCancelled after supersede via beginRun
  - burst step-complete previews join single-flight map lifecycle without duplicate creates

### `world-builder/worldBuilderGenerationPolicy.test.js`

- **Seam:** `generation-orchestration` — Progress, cancel, and policy modules
- **Test count:** 8
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** generationProgressValue scales by completed steps; +7 additional cases
- **Cases:**
  - generationProgressValue scales by completed steps
  - generationProgressValue returns zero when step count is non-positive
  - shouldApplyStepPreviewToMap rejects step-complete without world document
  - shouldApplyStepPreviewToMap accepts validation step-complete with world document
  - shouldApplyStepPreviewToMap rejects non-validation step-complete even with world document
  - shouldApplyStepPreviewToMap accepts exhausted terminal with world document
  - shouldApplyStepPreviewToMap rejects exhausted terminal without world document
  - shouldApplyStepPreviewToMap rejects unknown delivery kinds

### `world-builder/worldBuilderGenerationSeamContract.test.js`

- **Seam:** `runtime-seam-contract` — ADR-0009 behavioral boundary; no source greps
- **Test count:** 4
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Pipeline cancellation semantics
- **Cases:**
  - generation policy decides previews and progress as a renderer-free pure function
  - generation composable runs to success and applies validation preview without a renderer
  - useWorldBuilderGeneration composable resets progress on cancel without page model helpers
  - generation run hooks reset overlay visibility before run and after success

### `world-builder/worldBuilderOverlayControls.test.js`

- **Seam:** `world-builder-unit` — Top-level world-builder module
- **Test count:** 2
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** createDefaultOverlayDisplaySettings includes arableMinimumProductivity default; +1 additional cases
- **Cases:**
  - createDefaultOverlayDisplaySettings includes arableMinimumProductivity default
  - formatOverlayControlValue formats arableMinimumProductivity to two decimals

### `world-builder/worldBuilderPageModel.test.js`

- **Seam:** `page-display-model` — Validation/hydrology display projections
- **Test count:** 29
- **Skip conditions:** None — runs under npm run test:world-builder
- **Behaviors:** Contract derivation or selector wiring; Seed determinism
- **Cases:**
  - createDefaultControlsState matches default geography seed and generation options
  - buildDerivedGeographyParams forwards stream-power options to worker payload
  - buildDerivedGeographyParams forwards enableMeanderRefine to worker payload
  - buildDerivedGeographyParams forwards maxMetalNodes to worker payload
  - buildDerivedGeographyParams forwards arableMinimumProductivity to worker payload
  - createDefaultGenerationSettings resets sliders and seed-derived wind without changing seed
  - normalizeGeographySeed converts signed 32-bit values to unsigned
  - createHydrologySubstepStatuses marks active and completed substeps
  - createHydrologySubstepStatuses marks skipped substeps
  - formatHydrologySubstepTimingForDisplay omits duration for skipped substeps
  - createHydrologySubstepTimingsForDisplay reads report timings
  - createGenerationStepStatuses marks active and completed steps
  - validationStatusColor and validationStatusIcon cover hard failures
  - createValidationRowsForDisplay omits hydrology shape checks from sidebar
  - createHydrologyStatsForDisplay surfaces hydrology metrics and rejection state
  - createHydrologyStatsForDisplay defaults when hydrology section missing
  - createValidationRowsForDisplay preserves contract metadata on rows
  - formatSlopeAreaConcavityForDisplay renders median and sample count
  - formatHydrologyMetricValue renders null as n/a
  - createResourceOverlayDefinitions lists canonical overlay ids and kinds
  - createDefaultResourceOverlayVisibility defaults every overlay off
  - shouldShowGenerationProgress is true only while running
  - shouldShowResourceOverlayBar is true only after successful pipeline completion
  - shouldShowResourceOverlayBar stays hidden after failed mid-pipeline runs
  - shouldShowValidationFailureIndicator is true only for exhausted runs
  - isGenerationRunSuccess is true only for success status
  - WORLD_BUILDER_VALIDATION_EXHAUSTED_INDICATOR_TEST_ID is a stable non-empty string
  - exhausted run presentation hides clean-success chrome
  - status bar helpers never show progress and overlay bar together

---

## Seam contract files (quick reference)

| File | Seam under test |
|------|-----------------|
| `world-builder/worldBuilderGenerationSeamContract.test.js` | Generation without renderer |
| `world-builder/renderer/rendererSeamContract.test.js` | Renderer without generation path |
| `world-builder/resourceOverlayStateSeamContract.test.js` | Overlay owner → viewport |
| `world-builder/renderer/resourceRasterOverlaySeamContract.test.js` | Raster overlay refresh |
| `world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js` | Simulation river mask seam |

---

## Related docs

- [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md) — thermo instant-REWORK rules for seam tests
- [MINI-REVIEW-RUBRICS.md](./MINI-REVIEW-RUBRICS.md) — slice-type review checklists
- [PAGE-CONTROLLER-INTERFACE.md](./PAGE-CONTROLLER-INTERFACE.md) — controller method → test mapping (#375)
- [COMMIT-SLICE-MAP.md](./COMMIT-SLICE-MAP.md) — which issue owns seam test edits

