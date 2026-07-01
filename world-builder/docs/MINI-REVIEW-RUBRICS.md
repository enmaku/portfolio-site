# Mini review rubrics — Phase 5 slice types

> **Purpose:** Checklists for readonly mini **thermo-nuclear** and **architecture** reviewers per [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md). Parent launches reviewer with: *Apply thermo-nuclear + architecture rubrics to files changed in #N. MINI-REVIEW-RUBRICS.md § `{slice-type}`. Verdict: PASS or REWORK.*

Tag findings: `[blocker]`, `[structure]`, or `[advisory]`. Architecture **Strong** = REWORK.

---

## Global instant REWORK (all slice types)

Any one triggers REWORK regardless of slice section:

| # | Condition |
|---|-----------|
| G1 | `HydrologyWorld & Record<string, unknown>` or equivalent god-bag in hydrology composition |
| G2 | Public substep/stage `run(input: Record<string, any>, …)` |
| G3 | Production file **>1000 lines** without PR justification |
| G4 | Hand-maintained `inputKeys`/`outputKeys` parallel to module metadata (post-#360 landmass, post-#355 hydrology) |
| G5 | `vectorOverlays` in new production renderer code (post-#362) |
| G6 | Test title mentions simulation without asserting `simulationRiverMask` |
| G7 | `readFileSync` source inspection in runtime seam tests (research asset tests exempt) |
| G8 | Renderer import in generation/core path |
| G9 | UI copy string assertions in unit tests |

---

## § `hydrology-type` — #355

**Files typical:** `hydrologyWorldTypes.js`, `hydrologySubsteps.js`, `hydrologySubstepContracts.js`, substep module types.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] No `Record<string, unknown>` on public hydrology world/stage types |
| T2 | [blocker] Each substep `run` input is explicit typedef, not open record |
| T3 | [structure] `selectHydrologySubstepInput` only reads keys declared in module `inputs` |
| T4 | [structure] `buildPipelineStateFromHydrologyWorld` reads typed stage outputs only |
| T5 | [advisory] No redundant manual contract tables alongside derived contracts |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** God-bag reintroduced under new typedef name |
| A2 | **Strong:** Runner bypasses module boundary for one substep |
| A3 | Module owns narrow contract; runner owns order/skip/hooks only |
| A4 | Deletion test: removing a substep module breaks compile or contract derive |

---

## § `hydrology-file-split` — #356

**Files typical:** `core/hydrology/substeps/*.js`, registry `index.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] No substep file >250 lines without justification |
| T2 | [blocker] Registry file ≤80 lines, import-only |
| T3 | [structure] Monolithic `hydrologySubstepModules.js` deleted or shim-only |
| T4 | [structure] `baselineDrainageFromState` extracted if shared |
| T5 | [advisory] No behavior change in test outcomes |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Circular imports between substeps |
| A2 | One module per substep id; registry is sole order authority |
| A3 | Shared helpers live in neutral util files, not copied |

---

## § `landmass-module` — #359

**Files typical:** `core/stages/*Stage.js`, `landmassPipelineStageModules.js`, `derivedGeographyPipeline.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Each stage exports `id`, `label`, `inputs`, `outputKeys`, `run` |
| T2 | [blocker] `executeLandmassPipelineStage` switch removed — module dispatch only |
| T3 | [structure] Stage `run` bodies match pre-refactor behavior (diff review) |
| T4 | [structure] Hydrology stage delegates to existing runner, no fork |
| T5 | [advisory] Stage files ≤150 lines each |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Stage module reaches into renderer |
| A2 | **Strong:** Duplicate stage order outside registry |
| A3 | Mirrors hydrology module pattern ([LANDMASS-STAGE-MODULES.md](./LANDMASS-STAGE-MODULES.md)) |
| A4 | `runPipelineStep` remains public API stable |

---

## § `landmass-contract-derive` — #360

**Files typical:** `landmassPipelineStageContracts.js`, contract tests.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] `LANDMASS_PIPELINE_STAGE_CONTRACTS` computed from modules |
| T2 | [blocker] `rg 'inputKeys:' world-builder/core/ --glob '*.js' \| rg -v derive` → 0 hits |
| T3 | [structure] `pickLandmassStageInput` uses module selectors |
| T4 | [structure] Redundant JSDoc input typedefs removed if duplicate module keys |
| T5 | [advisory] Precondition errors preserved verbatim |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Parallel manual contract table remains |
| A2 | **Strong:** assertLandmassStageOutputs validates different keys than module |
| A3 | Derivation mirrors `HYDROLOGY_SUBSTEP_CONTRACTS` pattern |
| A4 | Deletion test on old picker switch |

---

## § `orchestrator-decompose` — #361

**Files typical:** `cloneWorldDocument.js`, `buildWorldDocumentFromPipelineState.js`, `landmassPipelineRunner.js`, slim orchestrator.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] `derivedGeographyPipeline.js` ≤650 lines |
| T2 | [blocker] No new file >1000 lines |
| T3 | [structure] `cloneWorldDocument.js` ≤80 lines |
| T4 | [structure] `buildWorldDocumentFromPipelineState.js` ≤70 lines |
| T5 | [structure] `landmassPipelineRunner.js` ≤300 lines |
| T6 | [advisory] Worker + integration imports updated |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Orchestrator still contains stage implementation bodies |
| A2 | **Strong:** Runner imports renderer |
| A3 | Facade re-exports preserve external import paths |
| A4 | Sync vs async hook split preserved ([ORCHESTRATOR-DECOMPOSITION.md](./ORCHESTRATOR-DECOMPOSITION.md)) |

---

## § `overlay-vector-layer` — #362

**Files typical:** `createWorldBuilderMapViewport.js`, `mapLayerRefresh.js`, overlay diff modules.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] No production `vectorOverlays` monolith (grep gate) |
| T2 | [blocker] Per-family vector layer IDs: coastal, salt, metal nodes |
| T3 | [structure] `diffResourceOverlayMapLayers` uses per-layer refresh |
| T4 | [structure] Raster overlay locality unchanged |
| T5 | [advisory] eslint clean on renderer touches |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Toggling salt refreshes coastal draw handler |
| A2 | Overlay owner seam intact — viewport mutations only via owner |
| A3 | MapLayerId type extended consistently in viewport model |

---

## § `overlay-vector-test` — #363

**Files typical:** `createWorldBuilderMapViewport.overlaySync.test.js`, related viewport tests.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] No `readFileSync` or import-path ban assertions |
| T2 | [structure] Per-layer spy harness (`drawnCirclesByLayer` or equivalent) |
| T3 | [structure] Salt toggle does not rebuild resource raster RGBA |
| T4 | [structure] Coastal draw count unchanged when toggling salt only |
| T5 | [advisory] Tests run under module mocks, not skipped |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Tests assert copy strings |
| A2 | Behavioral locality only — counts and call spies |
| A3 | Aligns with [OVERLAY-LAYER-LOCALITY.md](./OVERLAY-LAYER-LOCALITY.md) |

---

## § `simulation-seam-test` — #364

**Files typical:** `*SeamContract*.test.js`, `hydrologyRiverPathfindingSeamContract.test.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Default generation asserts populated `simulationRiverMask` |
| T2 | [blocker] No test title says "simulation" while checking presentation only |
| T3 | [structure] Length and cell count > 0 on simulation mask |
| T4 | [structure] SEAM-TEST-CATALOG updated if titles change |
| T5 | [advisory] Documents Option A default (simulation may equal presentation) |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Logistics tests assert `riverNetworkMask` where simulation required |
| A2 | Public API only — no reaching into mask pipeline internals |
| A3 | Vocabulary matches SIMULATION-VS-PRESENTATION doc |

---

## § `simulation-consumer` — #365

**Files typical:** `buildGenerationReport.js`, `runGeographyValidationChecks.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Validation river assembly uses simulation mask path |
| T2 | [structure] Meander on → validation metrics unchanged |
| T3 | [structure] Report hydrology section cites simulation graph |
| T4 | [advisory] No presentation option leaks into physics checks |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** `assembleRiverNetwork` fed presentation mask for navigability |
| A2 | Clear separation: presentation for map, simulation for metrics |
| A3 | Tests in validation + report modules |

---

## § `worker-clone` — #366

**Files typical:** `cloneWorldDocument.js`, worker protocol, `runDerivedGeographyInWorker.test.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] `simulationRiverMask` in worker payloads |
| T2 | [structure] Clone deep-copies simulation independently of presentation |
| T3 | [structure] Preview with meander on retains simulation field |
| T4 | [advisory] No shared buffer mutation across threads |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Clone shares typed array backing store with source |
| A2 | Worker protocol tests document payload schema |
| A3 | Clone module single responsibility |

---

## § `checkbox-ux` — #367

**Files typical:** `resourceOverlayState.js`, `WorldBuilderPage.vue`, overlay composable.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Checkbox returns to unchecked, not indeterminate |
| T2 | [structure] Boolean normalization in overlay owner before commit |
| T3 | [structure] No tri-state `:model-value` binding |
| T4 | [advisory] Behavioral test at composable seam, no copy asserts |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Quasar tri-state leaked into persisted store |
| A2 | Owner remains sole viewport mutation authority |

---

## § `page-sfc` — #368

**Files typical:** `WorldBuilderPage.vue`, `worldBuilderPageModel.js`, controller.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] SFC has no `@world-builder/core` imports |
| T2 | [blocker] SFC has no worker or map lifecycle handles |
| T3 | [structure] Display helpers moved to page model |
| T4 | [advisory] Line count reduced or imports strictly fewer |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** SFC imports renderer implementation |
| A2 | [PAGE-CONTROLLER-INTERFACE.md](./PAGE-CONTROLLER-INTERFACE.md) is the page seam |
| A3 | ADR-0009 checklist satisfied |

---

## § `page-controller-test` — #375

**Files typical:** `useWorldBuilderPageController.test.js`.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Every public side-effect method has behavioral test |
| T2 | [blocker] Injected fakes — no full page mount |
| T3 | [structure] `onToggleChange` regenerates; `onSliderInput` does not |
| T4 | [structure] `start()` verifies overlay sync on viewport ready |
| T5 | [advisory] No copy assertions |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Tests import real renderer or worker |
| A2 | Matrix matches controller interface doc |
| A3 | Errors forward via `onGenerationError` |

---

## § `audit-adr` — #370, #379, #380

**Files typical:** seam contract tests, grep audits.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Zero renderer imports in core/worker generation path |
| T2 | [structure] Three seam contract files complete behavioral coverage |
| T3 | [structure] No readFileSync greps in runtime seam tests |
| T4 | [advisory] Findings in PR test plan, not ad-hoc docs |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Generation composable imports Pixi/viewport |
| A2 | ADR-0009 compliance checklist fully ticked |
| A3 | Depth/locality vocabulary in review prose |

---

## § `regression-guard` — #357, #358, #369, #371, #372, #374, #376–#378, #383–#386

**Files typical:** test-only or audit-only; minimal production fixes.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] Issue acceptance criteria met verbatim |
| T2 | [structure] No drive-by refactors outside MAY touch list |
| T3 | [structure] Targeted tests green; full suite if issue requires |
| T4 | [advisory] Skip count 0 where issue specifies (#369, #378) |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** Production refactor smuggled in "test fix" |
| A2 | Tests prove behavior not implementation detail |
| A3 | Catalog entry updated in [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) when seams change |

---

## § `docs-only` — #373

**Files typical:** `world-builder/CONTEXT.md` only.

### Thermo checklist

| ID | Check |
|----|-------|
| T1 | [blocker] No implementation detail in CONTEXT.md |
| T2 | [structure] Simulation vs presentation terms defined |
| T3 | [structure] `_Avoid` aliases documented |
| T4 | [advisory] Matches SIMULATION-VS-PRESENTATION doc |

### Architecture checklist

| ID | Check |
|----|-------|
| A1 | **Strong:** CONTEXT contradicts code seam names |
| A2 | Glossary-only changes |

---

## Verdict template

```markdown
## Mini review — #{issue} § `{slice-type}`

**Verdict:** PASS | REWORK

### Thermo
- Blockers: 0
- Structure: 0
- Advisory: 0

### Architecture
- Strong: 0
- Other: 0

### Findings
- R1 [blocker] …
- R2 [structure] …

### Notes
…
```

---

## Related

- [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md)
- [SUBAGENT-OPERATING-MODEL.md](./SUBAGENT-OPERATING-MODEL.md)
- Issue plans under [plans/](./plans/)
