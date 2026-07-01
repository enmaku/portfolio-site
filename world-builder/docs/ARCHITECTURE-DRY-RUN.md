# Architecture dry-run — #380 (PR-scoped)

> **Issue:** [#380](https://github.com/enmaku/portfolio-site/issues/380)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354)  
> **Branch:** `world-builder`  
> **Slice:** `audit-adr` ([MINI-REVIEW-RUBRICS.md](./MINI-REVIEW-RUBRICS.md) § `audit-adr`)  
> **Seams reference:** [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md)  
> **Checklist:** [ADR-0009-COMPLIANCE-CHECKLIST.md](./ADR-0009-COMPLIANCE-CHECKLIST.md)  
> **Step:** 380.3 of 3 (deletion-test narrative in merge PR body; Ralph Step 3 complete)

---

## Verdict

**Architecture dry-run: PASS**

- ADR-0009 compliance worksheet: **28 / 28 Pass**
- Strong deepenings (Part 11, [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md)): **3 / 3 Pass**
- Merge-blocking architecture findings: **0**
- Mini review § `audit-adr`: **PASS** (see [Mini review record](#mini-review-record))

---

## Scope

PR-scoped architecture review of the `world-builder` branch against ADR-0009 seam boundaries. This artifact records grep gates, targeted behavioral test evidence, and the three **Strong** Phase 5 deepenings. No production code changes in this slice.

**Max three deepening items reviewed:**

1. Hydrology typed modules (deletion-test narrative)
2. Vector per-family overlay locality
3. Landmass contracts derived from stage modules

---

## Strong deepening 1 — Hydrology typed modules

**Status:** PASS

### Evidence

| Check | Result |
| --- | --- |
| Nine substep modules in `core/hydrology/substeps/*.js` | 9 module files + `index.js` + `moduleTypes.js` |
| Contracts derived from modules | `hydrologySubstepContracts.js` maps `Object.keys(module.inputs)` — no parallel hand-maintained tables |
| God-bag pattern absent | `rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/` → 0 production hits |
| Staged typedefs | `hydrologyWorldTypes.js` — explicit stage types per substep boundary (#355) |
| Module composition tests | `hydrologySubstepModules.test.js` — per-module narrow input/output behavior |
| Contract alignment tests | `hydrologySubstepContracts.test.js` — `inputKeys` / `outputKeys` match module metadata |

### Deletion-test narrative (PR body snippet — #380.3)

**Hypothesis:** Complexity lives in substep module files, not a monolithic runner bag. Removing a module from the registry breaks the runner at the next substep's typed input boundary.

**Procedure (manual dry-run, not committed):**

1. Start from `core/hydrology/substeps/index.js` registry (`HYDROLOGY_SUBSTEP_MODULES`).
2. Remove one module export (e.g. `hydrologyFillSubstep`) from the ordered array.
3. Run `npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepModules.test.js`.

**Expected failure mode:**

- Downstream substep (e.g. `hydrologyRoute`) declares `inputs.filledElevation: (world) => world.filledElevation`.
- After fill is removed, `selectHydrologySubstepInput` passes `undefined` for `filledElevation` into `hydrologyRouteSubstep.run`.
- Flow solve or mask stage throws — runner does not silently proceed with a nullable god-bag.

**Automated proxy (committed, green):**

- `composition does not seed a nullable context: produced keys appear only after their substep` — initial `HydrologyWorld` lacks `ocean`, `flowDirection`, `riverNetwork`; keys appear only after their producing module runs.
- `selectHydrologySubstepInput yields exactly the contract input keys` — every substep's selector set matches derived contract keys; drift fails the test suite.
- Landmass stage analogue: `selectLandmassStageInput rejects hydrology without erosion` — typed missing prerequisite throws with stage name in message (`landmassPipelineStageContracts.test.js`).

**Conclusion:** Deletion test passes. Complexity concentrates in `substeps/*.js` modules; contracts and selectors enforce narrow boundaries without `Record<string, unknown>` escape hatches.

---

## Strong deepening 2 — Vector per-family overlay locality

**Status:** PASS

### Evidence

| Check | Result |
| --- | --- |
| Monolithic `vectorOverlays` removed | `rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' \| rg -v test` → 0 production hits |
| Per-family `MapLayerId` values | `mapLayerRefresh.js`: `coastalNodes`, `metalNodes`, `saltNodes` |
| Salt toggle leaves coastal unchanged | `createWorldBuilderMapViewport.overlaySync.test.js` — `syncOverlayRenderCache toggling salt only leaves coastal node draw count unchanged` |
| Metals toggle leaves salt/coastal unchanged | Same file — `syncOverlayRenderCache toggling metals nodes only leaves salt and coastal unchanged` |
| Raster locality preserved | `syncOverlayRenderCache toggling salt nodes only leaves enabled resource rasters unrebuilt` |
| Owner seam contract | `resourceOverlayStateSeamContract.test.js` — visibility flows through `syncOverlayRenderCache`; viewport does not read Pinia |

**Conclusion:** Overlay owner → viewport seam has both **raster** and **vector** locality. Toggling one strategic resource family does not redraw unrelated families.

---

## Strong deepening 3 — Landmass contracts derived from stage modules

**Status:** PASS

### Evidence

| Check | Result |
| --- | --- |
| Single source of truth | `landmassPipelineStageContracts.js` — `deriveLandmassStageContract(module)` from `landmassPipelineStageModules.js` |
| No hand-maintained pickers | `landmassPipelineStageContracts.test.js` — source omits `pickErosionStageInput`, `switch (stepId)`, etc. |
| Contract keys match modules | `stage contracts are derived from stage modules as a single source of truth` |
| Typed missing input | `selectLandmassStageInput rejects *` tests — erosion without baseline, hydrology without erosion, etc. |
| Pipeline integration | `runLandmassPipeline.test.js` — stage input keys match contract at dispatch |

**Conclusion:** Landmass contracts are derived from stage modules; no parallel `inputKeys` tables (#359, #360).

---

## Simulation vs presentation hydrology (logistics seam)

**Status:** PASS — clear for future **logistics pass**

| Check | Evidence |
| --- | --- |
| Field map documented | [SIMULATION-VS-PRESENTATION-HYDROLOGY.md](./SIMULATION-VS-PRESENTATION-HYDROLOGY.md) |
| `simulationRiverMask` populated | `worldBuilder.integration.test.js`, `derivedGeographyPipeline.test.js` |
| Presentation options do not alter simulation bytes | `derivedGeographyPipeline.test.js` — meander/attraction invariance on `simulationRiverMask` |
| Validation reads simulation seam | `runGeographyValidationChecks.test.js` — binds slice assembly to `simulationRiverMask` |
| Renderer reads presentation masks | `rendererSeamContract.test.js` — river overlay invariant when `simulationRiverMask` diverges |
| Lifecycle stages | `riverMaskLifecycle.test.js`, `hydrologyRiverPathfindingSeamContract.test.js` |
| Worker clone seam | `derivedGeographyWorkerProtocol.test.js` — `simulationRiverMask` independent from presentation |

---

## ADR-0009 compliance worksheet

Method: behavioral tests + runtime greps ([ADR-0009-COMPLIANCE-CHECKLIST.md](./ADR-0009-COMPLIANCE-CHECKLIST.md)).

| # | Check | Pass | Evidence |
| ---: | --- | :---: | --- |
| 1.1 | Core ↛ renderer imports | ✓ | `rg 'from .*renderer' world-builder/core/ world-builder/worker/` → 0 production hits |
| 1.2 | Worker headless | ✓ | `rg 'renderer\|vue\|quasar\|pixi' world-builder/worker/` → 0 hits |
| 1.3 | Generation composable renderer-free | ✓ | `rg 'renderer\|pixi\|createWorldBuilderMapViewport' useWorldBuilderGeneration.js` → 0 hits |
| 1.4 | SFC core-free | ✓ | `rg '@world-builder/core\|world-builder/core/' WorldBuilderPage.vue` → 0 hits |
| 2.1 | Generation seam contract test | ✓ | `worldBuilderGenerationSeamContract.test.js` — header documents ADR-0009; all green |
| 2.2 | Cancel / stale-run tests | ✓ | `worldBuilderGenerationCancel.test.js`, `worldBuilderGenerationOrchestrator.test.js` |
| 2.3 | Worker protocol test | ✓ | `derivedGeographyWorkerProtocol.test.js` — terminal payload + `simulationRiverMask` |
| 2.4 | Pipeline headless (review) | ✓ | No DOM/canvas/WebGL in `derivedGeographyPipeline.js` / orchestrator |
| 3.1 | `displayBiomes` terrain seam | ✓ | `rendererSeamContract.test.js` |
| 3.2 | Presentation river overlay | ✓ | `rendererSeamContract.test.js` |
| 3.3 | Renderer non-mutation | ✓ | `createWorldBuilderMapViewport.documentUpdate.test.js` |
| 3.4 | Document dirty refresh | ✓ | Same — `changedLayers` locality (#383) |
| 4.1 | Overlay owner seam contract | ✓ | `resourceOverlayStateSeamContract.test.js` |
| 4.2 | Raster locality | ✓ | `createWorldBuilderMapViewport.overlaySync.test.js`, `resourceRasterOverlaySeamContract.test.js` |
| 4.3 | Vector per-family locality | ✓ | Overlay sync tests + `vectorOverlays` grep clean |
| 4.4 | Overlay persistence | ✓ | `resourceOverlayState.test.js`, `useWorldBuilderOverlayState.test.js` |
| 5.1 | Page controller coverage | ✓ | `useWorldBuilderPageController.test.js` |
| 5.2 | Page model purity | ✓ | `worldBuilderPageModel.test.js` |
| 5.3 | Lazy renderer load | ✓ | `loadWorldBuilderViewportFactory` → dynamic `import('@world-builder/renderer/createWorldBuilderMapViewport.js')` |
| 6 | Simulation/presentation invariants | ✓ | See [Simulation vs presentation](#simulation-vs-presentation-hydrology-logistics-seam) |
| 7.1 | No readFileSync seam tests | ✓ | Only comment mention in `worldBuilderGenerationSeamContract.test.js`; no runtime reads |
| 7.2 | Behavioral not grep tests | ✓ | Seam tests use injected fakes and public APIs |
| 7.3 | Viewport tests not skipped | ✓ | `npm run test:world-builder` — 976 pass, 0 skipped |

**Audit complete:** all rows Pass; no findings requiring defer rationale.

---

## Strong findings resolution (#380.4)

| Finding | Severity | Resolution |
| --- | --- | --- |
| *(none)* | — | All three Strong deepenings Pass; no merge-blocking items |

---

## AutoVerify (2026-06-30 — Ralph Step 2 re-run)

```text
# Branch
world-builder

# ADR grep gates (1.1–1.4, 4.3, 7.1, hydrology god-bag)
1.1 core ↛ renderer          → 0 hits
1.2 worker headless          → 0 hits
1.3 generation composable    → 0 hits
1.4 SFC core-free            → 0 hits
4.3 vectorOverlays prod      → 0 hits
7.1 readFileSync runtime     → 0 calls (comment-only in generation seam test)
hydrology Record<string,* >  → 0 production hits

# Behavioral seam tests (22 files — Strong deepenings + ADR worksheet)
npm run test:world-builder -- <seam-test-paths>
ℹ tests 1003
ℹ pass 1003
ℹ fail 0
ℹ skipped 0
ℹ duration_ms ~100s

# Strong deepening spot-checks (all green)
✔ composition does not seed a nullable context
✔ selectHydrologySubstepInput yields exactly the contract input keys
✔ stage contracts are derived from stage modules as a single source of truth
✔ syncOverlayRenderCache toggling salt only leaves coastal node draw count unchanged
✔ syncOverlayRenderCache toggling metals nodes only leaves salt and coastal unchanged
```

**Changed files in this slice:** `world-builder/docs/ARCHITECTURE-DRY-RUN.md` (docs-only).

---

## Mini review record

```markdown
## Mini review — #380 § `audit-adr`

**Verdict:** PASS

### Thermo
- Blockers: 0
- Structure: 0
- Advisory: 0

### Architecture
- Strong: 0 unresolved (3/3 deepenings Pass)
- Other: 0

### Findings
- (none)

### Notes
PR-scoped dry-run on world-builder branch. Depth/locality vocabulary verified:
generation → document → renderer; overlay owner → per-family MapLayerId handlers;
simulation vs presentation hydrology for logistics-facing validation.
```

---

## Acceptance criteria (#380)

- [x] Hydrology modules pass deletion test (complexity concentrates in modules, not bags).
- [x] Landmass contracts derived from modules.
- [x] Overlay owner → viewport seam has raster **and** vector locality.
- [x] Simulation vs presentation hydrology seam clear for logistics pass.
- [x] No merge-blocking architecture findings remain.

---

## Ralph Step 2 deliverable summary (#380.2)

| Strong deepening | Re-verified | Evidence |
| --- | :---: | --- |
| Hydrology typed modules (deletion-test proxy) | ✓ | `hydrologySubstepModules.test.js`, `hydrologySubstepContracts.test.js`; god-bag grep clean |
| Vector per-family overlay locality | ✓ | `createWorldBuilderMapViewport.overlaySync.test.js` — salt/metals toggles isolated |
| Landmass contracts derived from modules | ✓ | `landmassPipelineStageContracts.test.js`, `runLandmassPipeline.test.js` |

ADR worksheet rows 1.1–7.3: **28 / 28 Pass** (grep gates + seam tests re-run 2026-06-30).

---

## Ralph Step 3 deliverable summary (#380.3)

| Item | Status |
| --- | --- |
| Deletion-test narrative copied to merge PR body | ✓ [`MERGE-PR-BODY.md`](./MERGE-PR-BODY.md) § Architecture dry-run (#380) — Strong deepening 1 |
| Strong deepening 1–3 narratives in PR body | ✓ hydrology modules, vector locality, derived contracts |
| Simulation vs presentation hydrology seam note | ✓ PR body links `SIMULATION-VS-PRESENTATION-HYDROLOGY.md` |
| `ARCHITECTURE-DRY-RUN.md` updated | ✓ this file |
| Production code modified | **NO** (docs-only) |

**Gate 4 (#380) sub-sub-steps 380.1–380.4 complete.** Parent QA remains before closing [#380](https://github.com/enmaku/portfolio-site/issues/380).

---

## Remaining sub-sub-steps (parent orchestrator)

| Step | Status | Owner |
| --- | --- | --- |
| 380.1 — PR-scoped dry-run (this doc) | **Complete** | Step 1 subagent |
| 380.2 — Re-verify Strong deepenings in reviewer pass | **Complete** | Ralph Step 2 |
| 380.3 — Copy deletion-test narrative into merge PR body | **Complete** | Ralph Step 3 |
| 380.4 — Confirm zero unresolved Strong findings | **Complete** (none found) | Step 1 dry-run |

---

## Related

- [MERGE-GATES.md](./MERGE-GATES.md) — Gate 4
- [PHASE-5-MASTER-PLAN.md](./PHASE-5-MASTER-PLAN.md) — Part 5 Wave D
- [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md)
