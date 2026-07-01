# Merge PR body — `world-builder` → `main` (#382)

> **Purpose:** Paste-ready PR title and body for [#382](https://github.com/enmaku/portfolio-site/issues/382).  
> **Branch:** `world-builder` → `main`  
> **Assignee:** `enmaku`  
> **Status:** Ralph Step 2 of 3 complete — body verified; gate artifacts linked. **Do not** run `gh pr create` until Gate 5 manual QA execution + CI green (Ralph Step 3).  
> **Generated:** 2026-06-30

---

## PR title

```
World Builder Phase 5: landmass pipeline merge-readiness
```

---

## PR body (paste below this line into `gh pr create --body`)

```markdown
Merges the **World Builder** **landmass pipeline** from long-lived branch `world-builder` into `main` after Phase 5 merge-readiness ([#354](https://github.com/enmaku/portfolio-site/issues/354)). Delivers a headless **landmass pipeline**, Pixi map viewport, overlay owner seams, and behavioral regression guards — with structural debt from Phases 1–4 removed and ADR-0009 boundaries verified.

**Diff scope:** ~273 files, +45 111 / −5 lines vs `main`.

---

## Phase 1–5 summary

### Phase 1 — Landmass pipeline foundation

- **Scalar fields** and **physical terrain baseline** on a closed **island rim** grid
- **Derived geography** pipeline (erosion, hydrology, biomes, coast, **strategic resource** nodes)
- **Rejection sampling** via **validation checks** and generation report
- Worker-backed generation off the main thread; **world document** assembly for renderer replay

### Phase 2 — Generation lifecycle and map display

- Cancel / stale-run orchestration and step preview policy
- PixiJS 8 + pixi-viewport map viewport (ADR-0009 display stack)
- Map framing preserved across regeneration
- Lazy renderer load from page controller

### Phase 3 — Page seams and overlay architecture

- Page controller composable; generation composable renderer-free
- Overlay single-owner pattern (Pinia → viewport sync)
- **World Builder** page model extracted from SFC ([#368](https://github.com/enmaku/portfolio-site/issues/368))

### Phase 4 — Behavioral seams and raster locality

- Seam contract tests (generation, worker protocol, renderer, overlay owner)
- Raster overlay locality — toggling one **strategic resource** does not rebuild unrelated rasters
- Initial hydrology substep module registry; `simulationRiverMask` on **world document**
- Viewport behavioral tests for document dirty refresh and overlay sync

### Phase 5 — Structural debt removal ([#354](https://github.com/enmaku/portfolio-site/issues/354))

Phase 5 deleted forbidden patterns accumulated in Phases 1–4 so thermo-nuclear and architecture dry-runs pass with **zero structural blockers** before merge.

| Area | Outcome | Issues |
| --- | --- | --- |
| **Hydrology typed stages** | God-bag `HydrologyWorld & Record<string, unknown>` eliminated; nine substep modules in `core/hydrology/substeps/` with staged typedefs | #355, #356, #357, #358 |
| **Landmass stage modules** | Stage registry + contracts derived from modules (no hand-maintained `inputKeys` tables) | #359, #360 |
| **Orchestrator decomposition** | `derivedGeographyPipeline.js` slimmed to **193 lines**; clone and world-document assembly extracted | #361 |
| **Vector overlay locality** | Per-family `MapLayerId` refresh (`coastalNodes`, `metalNodes`, `saltNodes`); monolithic `vectorOverlays` removed | #362, #363 |
| **Simulation vs presentation hydrology** | `simulationRiverMask` is the logistics/validation seam; presentation options do not alter validation outcomes | #364–#366, #365, #386 |
| **Page seam hygiene** | SFC imports page model + controller only; no `@world-builder/core` in Vue SFC | #368, #375 |
| **Regression guards** | Seam contracts, integration smoke, cancel/stale-run, document dirty refresh, overlay persistence | #370, #374, #383–#385, #369 |
| **File size budget** | 0 violations; max production file **778 lines** | #372 |
| **Merge gates** | Full-repo lint, test, dry-run reviews, manual QA, this PR | #377–#382 |

**Explicitly out of scope (future epics):** **settlement** placement, **trade route** generation, full **logistics pass**, **culture engine**, **conflict engine**, **history log**, major UI redesign.

Full wave map: [`world-builder/docs/PHASE-5-MASTER-PLAN.md`](world-builder/docs/PHASE-5-MASTER-PLAN.md).

---

## ADR-0009 compliance

ADR: [`docs/adr/0009-world-builder-map-display-stack.md`](docs/adr/0009-world-builder-map-display-stack.md).  
Checklist: [`world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md`](world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md).

**Worksheet: 28 / 28 Pass** (verified in architecture dry-run [#380](https://github.com/enmaku/portfolio-site/issues/380)).

| Part | Seam | Status |
| ---: | --- | :---: |
| 1 | Package boundaries — core ↛ renderer, worker headless, generation composable renderer-free, SFC core-free | ✓ |
| 2 | Generation seam — orchestrator cancel/stale-run, worker terminal payload, headless pipeline | ✓ |
| 3 | Renderer pure-view — `displayBiomes`, presentation river overlay, non-mutation, document dirty refresh | ✓ |
| 4 | Overlay owner — raster + vector per-family locality, persistence | ✓ |
| 5 | Page controller lifecycle, page model purity, lazy renderer load | ✓ |
| 6 | Simulation vs presentation hydrology invariants | ✓ |
| 7 | Behavioral seam tests (no `readFileSync` greps; 0 skipped viewport suites) | ✓ |

**Three Strong deepenings (Phase 5):** all Pass — see [Architecture dry-run](#architecture-dry-run-380) below.

---

## Thermo-nuclear dry-run (#379)

- [x] Dry-run verdict: **PASS** — zero structural blockers
- [x] Global instant REWORK G1–G9: all clear
- [x] ADR-0009 compliance checklist: all rows pass
- [x] `npm run lint` + `npm test` + `npm run test:world-builder` green (0 skipped)
- [x] File-size budget: 0 violations; 4 >600-line extract candidates flagged
- [x] Full audit: [`world-builder/docs/THERMO-NUCLEAR-DRY-RUN.md`](world-builder/docs/THERMO-NUCLEAR-DRY-RUN.md)

**Structural-blocker inventory:** 0 blockers, 0 structure, 0 architecture Strong.

**Advisory (non-blocking, deferred):**

- `LandmassStageModule` JSDoc retains `Record<string, unknown>` at registry erasure boundary; `run` bodies destructure only declared `module.inputs` keys — accepted per #359/#360.
- Four production files exceed 600-line extract-candidate threshold (all under 800-line split trigger) — flagged in file size audit below.

---

## Architecture dry-run (#380)

- [x] Architecture dry-run: **PASS**
- [x] ADR-0009 worksheet: **28 / 28**
- [x] Strong deepenings: **3 / 3 Pass**
- [x] Merge-blocking architecture findings: **0**
- [x] Full audit: [`world-builder/docs/ARCHITECTURE-DRY-RUN.md`](world-builder/docs/ARCHITECTURE-DRY-RUN.md)

### Strong deepening 1 — Hydrology typed modules

Nine substep modules under `core/hydrology/substeps/`; contracts derived from `Object.keys(module.inputs)`; staged typedefs in `hydrologyWorldTypes.js`; no god-bag in production hydrology.

**Deletion-test narrative:** Removing a module from `HYDROLOGY_SUBSTEP_MODULES` breaks the runner at the next substep's typed input boundary — downstream `selectHydrologySubstepInput` passes `undefined` for missing prerequisites and the flow stage throws rather than silently proceeding with a nullable bag. Automated proxies: composition tests in `hydrologySubstepModules.test.js`; landmass analogue in `landmassPipelineStageContracts.test.js`.

### Strong deepening 2 — Vector per-family overlay locality

Monolithic `vectorOverlays` absent from production renderer. Per-family layer IDs (`coastalNodes`, `metalNodes`, `saltNodes`). Behavioral tests: salt toggle leaves coastal draw count unchanged; metals toggle leaves salt/coastal unchanged; raster locality preserved.

### Strong deepening 3 — Landmass contracts derived from stage modules

`landmassPipelineStageContracts.js` derives from `landmassPipelineStageModules.js`; no hand-maintained picker tables; typed missing-input throws at dispatch.

### Simulation vs presentation hydrology (logistics seam)

`simulationRiverMask` populated and round-tripped through worker clone; validation reads simulation seam; renderer reads presentation masks. Documented for future **logistics pass**: [`world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md`](world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md).

---

## File size audit (#372)

- [x] `npm run check:world-builder-file-size` — exit 0
- [x] No production file exceeds 1000 lines
- [x] `derivedGeographyPipeline.js` ≤650 lines (orchestrator) — **193 lines**
- [x] `hydrology/substeps/index.js` ≤80 lines (registry) — **31 lines**
- [x] Hydrology substep modules ≤250 lines each (#356) — max **137** (`hydrologySettleSubstep.js`)
- [x] `hydrologySubstepModules.js` is shim re-export only (#356) — **10 lines**

**Warnings (>600 lines — extract candidates, flag for follow-up):**

| File | Lines | Action |
| --- | ---: | --- |
| `world-builder/core/hydrology/connectNearbyRiverCorridors.js` | 604 | review for extract |
| `world-builder/core/hydrology/seededTemporaryRiverCarve.js` | 646 | review for extract |
| `world-builder/worldBuilderGenerationControls.js` | 632 | review for extract |
| `world-builder/core/hydrology/refineRiverNetwork.js` | 778 | review for extract (under 800; split before follow-up if growth continues) |

None exceed 800 lines; no split required before merge. `worldBuilderGenerationControls.js` accepted under #372 criterion 4.

Source: [`world-builder/docs/MERGE-PR-SNAPSHOT.md`](world-builder/docs/MERGE-PR-SNAPSHOT.md).

---

## Issues closed by this merge

Closes [#354](https://github.com/enmaku/portfolio-site/issues/354) (Phase 5 epic).

Implementation and gate issues completed on this branch:

Closes #355, #356, #357, #358, #359, #360, #361, #362, #363, #364, #365, #366, #367, #368, #369, #370, #371, #372, #373, #374, #375, #376, #377, #378, #379, #380, #381, #382, #383, #384, #385, #386.

**Does not close** [#293](https://github.com/enmaku/portfolio-site/issues/293) (grandparent epic — settlement, culture engine, history log, and broader product milestones remain open).

Prior stabilization phases ([#315](https://github.com/enmaku/portfolio-site/issues/315), #316–#353) were closed before Phase 5.

---

## Test plan

### Automated gates

Run from repository root on `world-builder` branch.

- [ ] `npm run lint` — exit 0
- [ ] `npm test` — exit 0, **0 skipped** viewport behavioral suites ([#369](https://github.com/enmaku/portfolio-site/issues/369))
- [ ] `npm run test:world-builder` — exit 0, **0 skipped** (976 tests as of dry-run)
- [ ] `npm run test:world-builder` — second run (flake check)
- [ ] `npm run check:world-builder-file-size` — exit 0
- [ ] `npm run build` — exit 0 (if CI runs build)

**Instant-REWORK greps** (expect 0 production hits):

```bash
rg 'Record<string, unknown>' world-builder/core/hydrology/ --glob '*.js'
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test
rg 'readFileSync' world-builder --glob '*Seam*.test.js'
rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test
rg '@world-builder/core|world-builder/core/' src/pages/projects/WorldBuilderPage.vue
```

**Dry-run evidence (local, 2026-06-30):**

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm test` | 2665 pass, 0 fail, 0 skipped |
| `npm run test:world-builder` | 976 pass, 0 fail, 0 skipped |
| `checkFileSizeBudget.mjs` | 0 violations, 4 >600 warnings |

Re-verify on PR CI before merge.

### Manual QA — Gate 5 ([#381](https://github.com/enmaku/portfolio-site/issues/381))

**Environment:** `npx quasar dev` → `http://localhost:9000/#/projects/world-builder`

> **Note:** Checkboxes below are filled during Ralph Step 2 (manual execution) and recorded in Step 3. Gate 5 must pass before merge.

| # | Step | Pass |
| ---: | --- | :---: |
| 1 | Generate default **world**; map renders | ☐ |
| 2 | Pan and zoom work | ☐ |
| 3 | Framing preserved on regen | ☐ |
| 4 | Cancel mid-generation; UI recovers; no stuck progress | ☐ |
| 5 | Toggle each **strategic resource** overlay on/off; no indeterminate checkbox | ☐ |
| 6 | Change arable envelope threshold; only arable overlay affected | ☐ |
| 7 | Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)) | ☐ |
| 8 | Change **geography seed**; regen; validation panel updates | ☐ |
| 9 | Reset defaults; overlay display settings restore | ☐ |
| 10 | Validation row map focus zooms expected region | ☐ |
| 11 | Exhausted **rejection sampling** run shows failure indicator; map still usable | ☐ |

**381.5 reload spot-check (Gate 5 row 7):**

1. Generate default **world**; wait for map.
2. Enable **arable** overlay if needed.
3. Move **arable envelope threshold** slider away from default; confirm only arable overlay changes.
4. Reload page (hard refresh OK).
5. **Pass:** slider retains threshold; overlay reflects value after regen or refresh.

Source: [`world-builder/docs/MANUAL-QA-READINESS.md`](world-builder/docs/MANUAL-QA-READINESS.md), [`world-builder/docs/MERGE-GATES.md`](world-builder/docs/MERGE-GATES.md) Gate 5.

**Defect policy:** File blocking issues before merge if any Gate 5 row fails.

---

## Related documents

| Document | Role |
| --- | --- |
| [`world-builder/docs/PHASE-5-MASTER-PLAN.md`](world-builder/docs/PHASE-5-MASTER-PLAN.md) | Wave map and success definition |
| [`world-builder/docs/MERGE-GATES.md`](world-builder/docs/MERGE-GATES.md) | Gates #377–#382 |
| [`world-builder/docs/COMMIT-READINESS.md`](world-builder/docs/COMMIT-READINESS.md) | Gate 0 (#376) commit hygiene |
| [`world-builder/docs/ESLINT-GATE-READINESS.md`](world-builder/docs/ESLINT-GATE-READINESS.md) | Gate 1 (#377) ESLint audit |
| [`world-builder/docs/TEST-GATE-READINESS.md`](world-builder/docs/TEST-GATE-READINESS.md) | Gate 2 (#378) test audit |
| [`world-builder/docs/THERMO-NUCLEAR-DRY-RUN.md`](world-builder/docs/THERMO-NUCLEAR-DRY-RUN.md) | Gate 3 (#379) thermo-nuclear audit |
| [`world-builder/docs/ARCHITECTURE-DRY-RUN.md`](world-builder/docs/ARCHITECTURE-DRY-RUN.md) | Gate 4 (#380) architecture audit |
| [`world-builder/docs/MANUAL-QA-READINESS.md`](world-builder/docs/MANUAL-QA-READINESS.md) | Gate 5 (#381) manual QA procedure |
| [`world-builder/docs/MERGE-PR-SNAPSHOT.md`](world-builder/docs/MERGE-PR-SNAPSHOT.md) | File size audit snapshot (#372) |
| [`world-builder/docs/FILE-SIZE-BUDGET.md`](world-builder/docs/FILE-SIZE-BUDGET.md) | Line limits (#372) |
| [`world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md`](world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md) | ADR-0009 worksheet (#370, #380) |
| [`world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md`](world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md) | Logistics seam (#364–#366) |
| [`world-builder/docs/ARCHITECTURE-SEAMS.md`](world-builder/docs/ARCHITECTURE-SEAMS.md) | Seam vocabulary |
| [`world-builder/CONTEXT.md`](world-builder/CONTEXT.md) | Domain glossary |
```

---

## `gh pr create` command (when ready)

Run only after Gate 5 manual QA passes and branch is pushed. **Assignee:** `enmaku`. **Not draft.**

```bash
gh pr create --base main --head world-builder \
  --title "World Builder Phase 5: landmass pipeline merge-readiness" \
  --assignee @me \
  --body-file world-builder/docs/MERGE-PR-BODY.md
```

> **Note:** `--body-file` expects raw markdown only. Strip this wrapper file's front matter and the outer `# Merge PR body` heading — use the content inside the **PR body** fenced block above, or extract programmatically before create.

Alternative (HEREDOC from repo root):

```bash
gh pr create --base main --head world-builder \
  --title "World Builder Phase 5: landmass pipeline merge-readiness" \
  --assignee @me \
  --body "$(sed -n '/^```markdown$/,/^```$/p' world-builder/docs/MERGE-PR-BODY.md | sed '1d;$d')"
```

---

## Ralph Step checklist (#382)

| Item | Step 1 | Step 2 |
| --- | :---: | :---: |
| PR title drafted | ✓ | ✓ |
| Phase 1–5 summary (#382.2) | ✓ | ✓ |
| ADR-0009 compliance section (#382.2) | ✓ | ✓ |
| Thermo-nuclear dry-run (#379) snippet | ✓ | ✓ |
| Architecture dry-run (#380) + deletion-test narrative | ✓ | ✓ |
| File size audit (#372) snippet | ✓ | ✓ |
| Issue closure list (#354, #355–#386; not #293) | ✓ | ✓ |
| Manual QA checklist from #381 (#382.3) | ✓ | ✓ (11 rows; checkboxes pending human QA) |
| Automated test plan | ✓ | ✓ |
| All gate artifacts linked (Gates 0–5) | — | ✓ |
| `gh pr create` (#382.1) | **Deferred** | **Deferred** — Step 3 |

**Next (Ralph Step 3):** Execute Gate 5 manual QA on `npx quasar dev`; check off manual QA rows; confirm CI green; open ready-for-review PR ([#382.1](https://github.com/enmaku/portfolio-site/issues/382), [#382.4](https://github.com/enmaku/portfolio-site/issues/382)). **Do not** use `--body-file` on this wrapper — extract the fenced PR body block or use the `sed` command above.
