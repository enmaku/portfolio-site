# Phase 5 master plan — final merge-readiness (#354)

Epic [#354](https://github.com/enmaku/portfolio-site/issues/354) is the **final merge-readiness pass** for the **World Builder** **landmass pipeline** on branch `world-builder`. Grandparent epic: [#293](https://github.com/enmaku/portfolio-site/issues/293). Phase 5 deletes structural debt accumulated in Phases 1–4 so thermo-nuclear and architecture dry-runs (#379, #380) produce **zero structural blockers** before merge PR [#382](https://github.com/enmaku/portfolio-site/issues/382) lands on `main`.

This document is the orchestrator's map: waves, issue table, anti-loop rules, and success definition. Every implementer and reviewer subagent must read it before writing production code.

---

## Part 1 — Mission and scope

### What Phase 5 delivers

Phase 5 makes the **landmass pipeline** merge-ready without expanding product scope:

- **Hydrology typed stages** — eliminate god-bag `HydrologyWorld & Record<string, unknown>`; each substep module owns explicit input/output types (#355, #356).
- **Landmass stage modules** — derived geography steps become module objects with derived contracts, not hand-maintained key tables (#359, #360).
- **Orchestrator decomposition** — `derivedGeographyPipeline.js` slimmed; clone and world-document assembly extracted (#361).
- **Renderer overlay locality** — vector overlays refresh per family (`coastalNodes`, `metalNodes`, `saltNodes`); no monolithic `vectorOverlays` (#362, #363).
- **Simulation vs presentation hydrology** — `simulationRiverMask` is the logistics-facing seam; presentation masks never leak into **validation checks** (#364–#366, #365, #386).
- **Page seam hygiene** — SFC thins to Quasar markup; generation, overlay owner, and viewport lifecycle live in composables (#368, #375, #367).
- **Regression guards** — seam contract tests, integration smoke, cancel/stale-run, document dirty refresh (#370, #374, #383–#385, #384).
- **Merge gates** — full-repo lint, full-repo test, dry-run reviews, manual QA, PR (#377–#382).

### Explicitly out of scope

Per [#354](https://github.com/enmaku/portfolio-site/issues/354) and every issue sub-plan:

- **Settlement** placement and tier simulation
- **Trade route** generation
- Full **logistics pass** (**movement cost**, **haul-shed**, **maritime reach** beyond existing validation)
- **Culture engine**, **conflict engine**, **history log**
- Major World Builder UI redesign
- Pixel-perfect renderer snapshot tests
- New git branch (all work stays on `world-builder`)

---

## Part 2 — Structural debt to delete (not rearrange)

These patterns are **forbidden outcomes** after Phase 5. Green tests alone do not satisfy the epic.

| Debt pattern | Why it blocks merge | Primary issues |
| --- | --- | --- |
| God-bag hydrology world (`Record<string, unknown>`) | Substeps hide dependencies; contracts rot | #355 |
| Monolithic `hydrologySubstepModules.js` | No deletion test; file-size blowout | #356 |
| Hand-maintained `inputKeys` / `outputKeys` parallel to modules | Dual ceremony; drift on every stage add | #360 |
| `derivedGeographyPipeline.js` >650 lines as orchestrator | Locality and review surface collapse | #361 |
| Monolithic `vectorOverlays` refresh | Toggle salt redraws coastal markers | #362 |
| Presentation masks in validation / logistics consumers | **Ox paradox** and navigability lie about physics | #365, #386 |
| Test titles claiming simulation but asserting presentation only | False confidence in seam coverage | #364 |
| `readFileSync` source greps in runtime seam tests | Tests inspect implementation, not behavior | #370 |
| `world-builder/core/**` importing `world-builder/renderer/**` | ADR-0009 violation | #370 |
| Production file >1000 lines without PR justification | Thermo-nuclear instant REWORK | #372 |
| Page SFC importing core/renderer/worker directly | Orchestration leak | #368 |

---

## Part 3 — Wave map

Waves enforce parallelization without violating dependency edges. **Wave 0 must PASS before any production code.**

### Wave 0 — DOC-AUDIT (docs-only)

Create and review mandatory documentation. No `.js` / `.vue` changes except this docs batch.

| Deliverable | Min lines | Purpose |
| --- | ---: | --- |
| `PHASE-5-MASTER-PLAN.md` | 200+ | This file |
| `ARCHITECTURE-SEAMS.md` | 250+ | Seam vocabulary + forbidden imports |
| `ADR-0009-COMPLIANCE-CHECKLIST.md` | 120+ | Behavioral audit steps |
| `SIMULATION-VS-PRESENTATION-HYDROLOGY.md` | 180+ | Field map + consumer rules |
| `MERGE-GATES.md` | 150+ | Commands for #377–#382 |
| `FILE-SIZE-BUDGET.md` | 80+ | Line limits per file type |

**DOC-AUDIT exit criteria:** parent confirms all six files exist, cross-link correctly, use vocabulary from [`world-builder/CONTEXT.md`](../CONTEXT.md), and reference real repo paths. Subagents may then start Wave A.

### Wave A — parallel foundations (no blockers)

Issues that can start immediately after DOC-AUDIT:

| Issue | Title | Slice type |
| ---: | --- | --- |
| [#355](https://github.com/enmaku/portfolio-site/issues/355) | Hydrology typed stage outputs | `hydrology-type` |
| [#359](https://github.com/enmaku/portfolio-site/issues/359) | Landmass pipeline stage modules | `landmass-module` |
| [#362](https://github.com/enmaku/portfolio-site/issues/362) | Vector overlay per-family map layer refresh | `overlay-vector-layer` |
| [#364](https://github.com/enmaku/portfolio-site/issues/364) | Fix simulation hydrology seam contract tests | `simulation-seam-test` |
| [#367](https://github.com/enmaku/portfolio-site/issues/367) | Resource overlay checkbox indeterminate state | `checkbox-ux` |
| [#368](https://github.com/enmaku/portfolio-site/issues/368) | Page display model extraction from SFC | `page-sfc` |

### Wave B — hydrology file split + landmass contracts

| Issue | Blocked by |
| ---: | --- |
| [#356](https://github.com/enmaku/portfolio-site/issues/356) | #355 |
| [#360](https://github.com/enmaku/portfolio-site/issues/360) | #359 |
| [#357](https://github.com/enmaku/portfolio-site/issues/357) | #355, #356 |
| [#358](https://github.com/enmaku/portfolio-site/issues/358) | #355, #356 |

### Wave C — orchestrator, overlay tests, simulation consumers

| Issue | Blocked by |
| ---: | --- |
| [#361](https://github.com/enmaku/portfolio-site/issues/361) | #359, #360 |
| [#363](https://github.com/enmaku/portfolio-site/issues/363) | #362 |
| [#365](https://github.com/enmaku/portfolio-site/issues/365) | #364 |
| [#366](https://github.com/enmaku/portfolio-site/issues/366) | #364 |
| [#383](https://github.com/enmaku/portfolio-site/issues/383) | #361, #362 |
| [#385](https://github.com/enmaku/portfolio-site/issues/385) | #362, #363 |

### Wave D — audits, regression guards, page controller tests

| Issue | Blocked by |
| ---: | --- |
| [#370](https://github.com/enmaku/portfolio-site/issues/370) | #361, #363, #365 |
| [#371](https://github.com/enmaku/portfolio-site/issues/371) | #357, #358, #360, #361 |
| [#372](https://github.com/enmaku/portfolio-site/issues/372) | #356, #361 |
| [#373](https://github.com/enmaku/portfolio-site/issues/373) | #365, #366 |
| [#374](https://github.com/enmaku/portfolio-site/issues/374) | #357, #358, #361 |
| [#375](https://github.com/enmaku/portfolio-site/issues/375) | #368 |
| [#384](https://github.com/enmaku/portfolio-site/issues/384) | #361, #375 |
| [#386](https://github.com/enmaku/portfolio-site/issues/386) | #365 |
| [#369](https://github.com/enmaku/portfolio-site/issues/369) | #362, #363 |

### Wave E — commit hygiene

| Issue | Blocked by |
| ---: | --- |
| [#376](https://github.com/enmaku/portfolio-site/issues/376) | All implementation issues #355–#375, #383–#386 |

Maintainer groups commits per [`COMMIT-SLICE-MAP.md`](./COMMIT-SLICE-MAP.md). Agent hooks block autonomous `git commit`; parent coordinates with maintainer.

### Wave F — full-repo gates

| Issue | Blocked by | Command |
| ---: | --- | --- |
| [#377](https://github.com/enmaku/portfolio-site/issues/377) | #376 | `npm run lint` |
| [#378](https://github.com/enmaku/portfolio-site/issues/378) | #376 | `npm test` |

See [`MERGE-GATES.md`](./MERGE-GATES.md) for full gate scripts.

### Wave G — dry-run reviews

| Issue | Blocked by |
| ---: | --- |
| [#379](https://github.com/enmaku/portfolio-site/issues/379) | #377, #378 |
| [#380](https://github.com/enmaku/portfolio-site/issues/380) | #377, #378 |

### Wave H — manual QA and merge PR

| Issue | Blocked by |
| ---: | --- |
| [#381](https://github.com/enmaku/portfolio-site/issues/381) | #379, #380 |
| [#382](https://github.com/enmaku/portfolio-site/issues/382) | #381 |

---

## Part 4 — Issue table (#355–#386)

| # | Title | Wave | Blocks | Slice type |
| ---: | --- | --- | --- | --- |
| 355 | Hydrology typed stage outputs (eliminate god-bag world) | A | 356, 357, 358, 376 | `hydrology-type` |
| 356 | Split hydrology substep modules into per-substep files | B | 357, 358, 372, 376 | `hydrology-file-split` |
| 357 | Hydrology flow-field recompute invariants | B | 371, 374, 376 | `regression-guard` |
| 358 | RiverMaskPipeline lifecycle invariants | B | 371, 374, 376 | `regression-guard` |
| 359 | Landmass pipeline stage modules | A | 360, 361, 376 | `landmass-module` |
| 360 | Derive landmass stage contracts from stage modules | B | 361, 371, 376 | `landmass-contract-derive` |
| 361 | Decompose derived geography pipeline orchestrator | C | 370, 372, 374, 376, 383, 384 | `orchestrator-decompose` |
| 362 | Vector overlay per-family map layer refresh | A | 363, 369, 376, 385 | `overlay-vector-layer` |
| 363 | Vector overlay refresh locality behavioral tests | C | 369, 376, 385 | `overlay-vector-test` |
| 364 | Fix simulation hydrology seam contract test assertions | A | 365, 366, 376 | `simulation-seam-test` |
| 365 | Validation and generation report consume simulation river interface | C | 370, 373, 376, 386 | `simulation-consumer` |
| 366 | Worker and clone round-trip for simulationRiverMask | C | 373, 376 | `worker-clone` |
| 367 | Resource overlay checkbox toggle and indeterminate state | A | 376 | `checkbox-ux` |
| 368 | World Builder page display model extraction from SFC | A | 375, 376 | `page-sfc` |
| 369 | Viewport behavioral tests guaranteed under npm test CI | D | 376 | `regression-guard` |
| 370 | ADR-0009 renderer and generation seam behavioral audit | D | 376 | `audit-adr` |
| 371 | Collapse redundant hydrology and landmass contract test duplication | D | 376 | `regression-guard` |
| 372 | Production file size audit (no file over 1000 lines) | D | 376 | `regression-guard` |
| 373 | CONTEXT.md simulation vs presentation hydrology vocabulary | D | 376 | `docs-only` |
| 374 | Default generation end-to-end smoke after Phase 5 refactors | D | 376 | `regression-guard` |
| 375 | Page controller behavioral coverage completeness | D | 376, 384 | `page-controller-test` |
| 376 | Phase 5 branch commit hygiene on world-builder | E | 377, 378 | `regression-guard` |
| 377 | Full repo eslint gate | F | 379, 380 | `regression-guard` |
| 378 | Full repo test gate | F | 379, 380 | `regression-guard` |
| 379 | Thermo-nuclear dry-run PR self-review | G | 381 | `audit-adr` |
| 380 | Architecture dry-run PR self-review | G | 381 | `audit-adr` |
| 381 | Manual QA checklist for World Builder Phase 5 | H | 382 | `regression-guard` |
| 382 | Open merge PR: world-builder → main | H | — | `regression-guard` |
| 383 | Map document dirty refresh regression guard | C | 376 | `regression-guard` |
| 384 | Generation cancel and stale-run regression guard | D | 376 | `regression-guard` |
| 385 | Pinia overlay display settings persistence regression | C | 376 | `regression-guard` |
| 386 | Rejection sampling and validation checks regression guard | D | 376 | `regression-guard` |

Sub-plans: [`plans/ISSUE-###.md`](./plans/). Subagent prompts: [`SUBAGENT-WAVE-PROMPTS/ISSUE-###.md`](./SUBAGENT-WAVE-PROMPTS/).

---

## Part 5 — Anti-loop rules

Phase 5 uses subagents heavily. These rules prevent infinite rework and scope creep.

### 1. One slice at a time

Each implementer touches only files listed in `MAY touch` for their issue. Drive-by refactors are REWORK on sight.

### 2. Implement → AutoVerify → mini thermo → mini arch → Parent QA

Every deliverable follows [`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md). Subagents **must not** skip reviews or mark GitHub issues complete.

### 3. Max three REWORK cycles

After three REWORK verdicts on the same sub-sub-step, escalate to parent for plan amendment. Do not hack forward.

### 4. No gap-analysis theater

Passing tests without deleting listed structural debt is **not** done. Parent QA checks acceptance criteria verbatim against the sub-plan, not against "feels fine."

### 5. No production code before DOC-AUDIT

Wave 0 documentation must exist and be reviewed. Subagent prompts include a **STOP** if DOC-AUDIT has not passed.

### 6. Parent closes issues; subagents hand off

Only the parent orchestrator closes GitHub issues after Parent QA. Implementers paste AutoVerify output and self-checklist; reviewers return PASS/REWORK.

### 7. No new branch, no product scope

Work stays on `world-builder`. Settlement, culture engine, history log requests are redirected to future epics.

### 8. Maintainer commits only

Agent git hooks block autonomous commit. #376 groups commits; implementers leave working tree ready for maintainer.

### 9. Forbidden instant-REWORK patterns

From [`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md) — any one triggers REWORK:

- God-bag hydrology types
- `Record<string, any>` on public substep `run`
- Production file >1000 lines
- Hand-maintained contract key tables (post-#360)
- `vectorOverlays` in new production renderer code (post-#362)
- Test title mentions simulation without asserting `simulationRiverMask`
- `readFileSync` in runtime seam tests
- Renderer import in generation/core path

### 10. Dry-runs must be clean before manual QA

#379 and #380 run only after #377 and #378 pass. Manual QA (#381) does not substitute for structural review.

---

## Part 6 — Success definition

Phase 5 succeeds when **all** of the following are true:

### Structural (must be deleted, not documented away)

1. Hydrology substeps use typed stage outputs; god-bag eliminated (#355, #356).
2. Landmass stage contracts derive from modules (#359, #360).
3. `derivedGeographyPipeline.js` orchestrator ≤650 lines; no production file >1000 without justification (#361, #372).
4. Vector overlay refresh is per-family; `vectorOverlays` absent from production renderer paths (#362, #363).
5. `simulationRiverMask` is the logistics/validation seam; presentation options do not change validation outcomes (#364–#366, #365, #386).
6. Page SFC does not import `@world-builder/core` or orchestrate generation (#368).
7. Seam contract tests are behavioral; no source greps in runtime tests (#370).

### Quality gates

8. `npm run lint` exits 0 (#377).
9. `npm test` exits 0 with **0 skipped** viewport behavioral suites (#378, #369).
10. `npm run test:world-builder` passes twice locally with 0 skipped (#378).
11. Thermo-nuclear dry-run (#379): zero structural blockers in PR description.
12. Architecture dry-run (#380): three Strong deepenings verified (hydrology modules, vector locality, derived contracts).

### Human verification

13. Manual QA checklist (#381) checked off in merge PR test plan.
14. Default **world** generation renders; pan/zoom; overlay toggles; cancel mid-run; validation panel updates.

### Merge artifact

15. Ready-for-review PR `world-builder` → `main` (#382) with Phase 1–5 summary, ADR-0009 compliance note, issue closure list, CI green, assignee enmaku.

### Epic closure

16. Parent closes [#354](https://github.com/enmaku/portfolio-site/issues/354) when #382 merges. [#293](https://github.com/enmaku/portfolio-site/issues/293) remains open until broader World Builder product milestones complete.

---

## Part 7 — Mandatory reading stack

Every implementer reads in order:

1. [`SUBAGENT-OPERATING-MODEL.md`](./SUBAGENT-OPERATING-MODEL.md)
2. [`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md)
3. [`MINI-REVIEW-RUBRICS.md`](./MINI-REVIEW-RUBRICS.md)
4. This file
5. Issue-specific docs listed in `plans/ISSUE-###.md`
6. [`world-builder/CONTEXT.md`](../CONTEXT.md) for domain vocabulary

---

## Part 8 — Related documents

| Document | Role |
| --- | --- |
| [`ARCHITECTURE-SEAMS.md`](./ARCHITECTURE-SEAMS.md) | Seam boundaries and forbidden imports |
| [`ADR-0009-COMPLIANCE-CHECKLIST.md`](./ADR-0009-COMPLIANCE-CHECKLIST.md) | Behavioral audit for #370 |
| [`SIMULATION-VS-PRESENTATION-HYDROLOGY.md`](./SIMULATION-VS-PRESENTATION-HYDROLOGY.md) | River mask field map |
| [`MERGE-GATES.md`](./MERGE-GATES.md) | Commands for #377–#382 |
| [`FILE-SIZE-BUDGET.md`](./FILE-SIZE-BUDGET.md) | Line limits |
| [`SEAM-TEST-CATALOG.md`](./SEAM-TEST-CATALOG.md) | Test file index per seam |
| [`../../docs/adr/0009-world-builder-map-display-stack.md`](../../docs/adr/0009-world-builder-map-display-stack.md) | ADR-0009 decision record |
