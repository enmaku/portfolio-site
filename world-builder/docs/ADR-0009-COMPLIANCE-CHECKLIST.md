# ADR-0009 compliance checklist — behavioral audit

Use this checklist for issue [#370](https://github.com/enmaku/portfolio-site/issues/370) and merge PR [#382](https://github.com/enmaku/portfolio-site/issues/382). ADR: [`docs/adr/0009-world-builder-map-display-stack.md`](../../docs/adr/0009-world-builder-map-display-stack.md). Architecture seams: [`ARCHITECTURE-SEAMS.md`](./ARCHITECTURE-SEAMS.md).

**Method:** behavioral tests and runtime greps — not `readFileSync` source inspection in seam tests (research asset tests exempt).

---

## Part 1 — Package boundary audit

### 1.1 Core does not import renderer

```bash
rg 'from ['\''\"].*renderer|from ['\''\"]@world-builder/renderer' \
  world-builder/core/ world-builder/worker/ \
  --glob '*.js' | rg -v '\.test\.'
```

**Pass:** zero hits.

**Fail action:** move shared types to `world-builder/core/types.js`; renderer imports core, never reverse.

### 1.2 Worker does not import renderer or Vue

```bash
rg 'renderer|vue|quasar|pixi' world-builder/worker/ --glob '*.js' | rg -v test
```

**Pass:** zero hits (worker protocol and pipeline only).

### 1.3 Generation composable does not import renderer

```bash
rg 'renderer|pixi|createWorldBuilderMapViewport' \
  src/composables/useWorldBuilderGeneration.js
```

**Pass:** zero hits.

### 1.4 Page SFC does not import core directly

```bash
rg '@world-builder/core|world-builder/core/' \
  src/pages/projects/WorldBuilderPage.vue
```

**Pass:** zero hits (#368).

---

## Part 2 — Generation seam (settings → world document)

### 2.1 Generation completes without viewport

**Test:** `world-builder/worldBuilderGenerationSeamContract.test.js`

**Assert:**

- `useWorldBuilderGeneration` runs with injected worker fake
- No viewport factory, Pixi, or DOM host in test scope
- Progress and preview policy exercised via `worldBuilderGenerationPolicy.js` pure functions

**Pass:** all tests green; test file documents ADR-0009 generation seam in header comment.

### 2.2 Orchestrator cancel and stale-run

**Tests:**

- `world-builder/worldBuilderGenerationCancel.test.js`
- `world-builder/worldBuilderGenerationOrchestrator.test.js`

**Assert:**

- `createGenerationRunController().beginRun()` invalidates prior run
- Cancel clears active job
- Stale preview does not apply after new run (#384)

### 2.3 Worker terminal message includes world document

**Test:** `world-builder/worker/derivedGeographyWorkerProtocol.test.js`

**Assert:**

- Terminal payload shape matches protocol
- `simulationRiverMask` present when hydrology completes (#366)

### 2.4 Pipeline does not call into Pixi

Manual review of:

- `world-builder/core/derivedGeographyPipeline.js`
- `world-builder/worldBuilderGenerationOrchestrator.js`

**Pass:** no DOM, canvas, WebGL, or `requestAnimationFrame` for simulation.

---

## Part 3 — World document → renderer seam (pure view)

### 3.1 Terrain reads displayBiomes only

**Test:** `world-builder/renderer/rendererSeamContract.test.js`

**Assert:**

- `buildLandTerrainRgba(doc)` colors cells from `doc.displayBiomes`
- Changing simulation `biomes` with same `displayBiomes` yields identical RGBA

### 3.2 River overlay reads presentation masks

**Test:** `world-builder/renderer/rendererSeamContract.test.js`

**Assert:**

- River overlay builder uses `riverNetworkMask` / corridor presentation fields
- Does not read `simulationRiverMask` for drawing (simulation is logistics-facing)

### 3.3 Renderer does not mutate world document

**Test:** `world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js`

**Assert:**

- `updateWorldDocument` reads incoming document; caller retains ownership
- No writes back to generation state from viewport module

### 3.4 Document dirty refresh locality

**Test:** `world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js`

**Assert:**

- `displayBiomes`-only change refreshes terrain layer set documented in test
- Presentation mask change refreshes rivers/lakes without full-stack rebuild unless required (#383)

---

## Part 4 — Overlay owner → viewport seam

### 4.1 Owner-only viewport mutation path

**Test:** `world-builder/resourceOverlayStateSeamContract.test.js`

**Assert:**

- Overlay visibility changes flow through `syncOverlayRenderCache` (or successor)
- Viewport does not read Pinia store directly

### 4.2 Raster overlay locality (Phase 4 regression)

**Tests:**

- `world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js`
- `world-builder/renderer/resourceRasterOverlaySeamContract.test.js`

**Assert:**

- Toggling one resource raster does not rebuild unrelated rasters

### 4.3 Vector overlay per-family locality (Phase 5)

**Tests:**

- `world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js` (extended #363)

**Assert:**

- Toggle salt nodes → salt draw handler only
- Toggle metals → metals handler only
- Coastal nodes unchanged when salt toggles

**Grep gate (post-#362):**

```bash
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
# Expect 0 production hits
```

### 4.4 Overlay settings persistence

**Tests:**

- `world-builder/resourceOverlayState.test.js`
- `src/composables/useWorldBuilderOverlayState.test.js`

**Assert:**

- `resetDefaults` restores persisted settings and syncs viewport once (#385)
- Boolean normalization — no tri-state checkbox leak (#367)

---

## Part 5 — Page controller seam

### 5.1 Controller owns lifecycle

**Test:** `src/composables/useWorldBuilderPageController.test.js`

**Assert:**

- `start()` wires generation + lazy viewport load
- `destroy()` cancels active generation (#384, #375)
- Public methods with side effects have behavioral coverage

### 5.2 Page model is presentation-only

**Test:** `world-builder/worldBuilderPageModel.test.js`

**Assert:**

- Format helpers pure — no imports from renderer or worker
- Validation row shaping exposes `mapFocus` for controller focus behavior

### 5.3 Lazy renderer load

**Inspect:** `src/composables/useWorldBuilderPageController.js`

**Pass:** `loadWorldBuilderViewportFactory` uses dynamic `import('@world-builder/renderer/createWorldBuilderMapViewport.js')`.

---

## Part 6 — Simulation vs presentation (ADR-adjacent)

ADR-0009 requires deterministic CPU simulation; presentation may diverge for map polish.

**Tests:**

- `world-builder/core/hydrology/riverMaskLifecycle.test.js`
- `world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js`
- `world-builder/core/derivedGeographyPipeline.test.js` (meander invariance)

**Assert:**

- `simulationRiverMask` populated after default generation
- Presentation options do not alter `simulationRiverMask` bytes (#358)
- Validation uses simulation seam (#365, #386)

Detail: [`SIMULATION-VS-PRESENTATION-HYDROLOGY.md`](./SIMULATION-VS-PRESENTATION-HYDROLOGY.md).

---

## Part 7 — Test hygiene (ADR compliance enablers)

### 7.1 No readFileSync in runtime seam tests

```bash
rg 'readFileSync' world-builder --glob '*Seam*.test.js'
# Expect 0 hits
```

### 7.2 No import-ban assertions in seam tests

Seam tests prove **behavior**, not forbidden import strings in source files.

**Pass:** overlay and generation seam tests use injected fakes and public APIs.

### 7.3 Viewport tests run under npm test

**Command:** `npm test 2>&1 | rg -c 'SKIP'`

**Pass:** 0 skipped viewport behavioral suites (#369).

---

## Part 8 — Audit worksheet (fill for #370 / #382)

| # | Check | Pass | Evidence |
| ---: | --- | :---: | --- |
| 1.1 | Core ↛ renderer imports | ☐ | grep output |
| 1.2 | Worker headless | ☐ | grep output |
| 1.3 | Generation composable renderer-free | ☐ | grep output |
| 1.4 | SFC core-free | ☐ | grep output |
| 2.1 | Generation seam contract test | ☐ | test name + pass |
| 2.2 | Cancel / stale-run tests | ☐ | test pass |
| 2.3 | Worker protocol test | ☐ | test pass |
| 3.1 | displayBiomes terrain seam | ☐ | test pass |
| 3.2 | Presentation river overlay | ☐ | test pass |
| 3.3 | Renderer non-mutation | ☐ | test pass |
| 3.4 | Document dirty refresh | ☐ | test pass |
| 4.1 | Overlay owner seam contract | ☐ | test pass |
| 4.2 | Raster locality | ☐ | test pass |
| 4.3 | Vector per-family locality | ☐ | test pass |
| 4.4 | Overlay persistence | ☐ | test pass |
| 5.1 | Page controller coverage | ☐ | test pass |
| 5.2 | Page model purity | ☐ | test pass |
| 5.3 | Lazy renderer load | ☐ | code review |
| 6 | Simulation/presentation invariants | ☐ | test pass |
| 7.1 | No readFileSync seam tests | ☐ | grep output |
| 7.2 | Behavioral not grep tests | ☐ | review |
| 7.3 | CI viewport tests not skipped | ☐ | npm test |

**Audit complete when:** all rows Pass; findings (if any) listed in merge PR test plan with fix or defer rationale.

---

## Part 9 — PR body snippet (for #382)

```markdown
## ADR-0009 compliance

- [ ] Package boundaries verified (core/worker/generation/renderer)
- [ ] Seam contract tests green (generation, renderer, overlay owner)
- [ ] Vector overlay per-family locality (#362–#363)
- [ ] Page controller owns lifecycle; SFC thin (#368, #375)
- [ ] simulationRiverMask logistics seam documented and tested
- [ ] Full checklist: world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
```
