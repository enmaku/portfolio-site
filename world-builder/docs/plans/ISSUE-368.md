# Issue #368 — World Builder page display model extraction from SFC

> **GitHub:** [#368](https://github.com/enmaku/portfolio-site/issues/368)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#368](https://github.com/enmaku/portfolio-site/issues/368) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).

### Blocks

- [#375](https://github.com/enmaku/portfolio-site/issues/375)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `page-sfc`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
6. world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
7. world-builder/docs/plans/ISSUE-368.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 368.1 — Inventory SFC script imports from core/renderer/worker.
2. 368.2 — Move format helpers to `worldBuilderPageModel.js`.
3. 368.3 — Move validation display wiring to model or controller.
4. 368.4 — SFC imports only: vue, quasar, controller composable, page model exports.
5. 368.5 — grep gate: no `@world-builder/core` in SFC.
6. 368.6 — Mini arch: page seam matches ADR-0009.

---

## Files MAY touch

- src/pages/projects/WorldBuilderPage.vue
- world-builder/worldBuilderPageModel.js
- world-builder/worldBuilderPageModel.test.js
- src/composables/useWorldBuilderPageController.js

---

## Files MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/renderer/createWorldBuilderMapViewport.js

Additional global forbiddens (all slices):

- `world-builder/core/**` importing from `world-builder/renderer/**`
- Drive-by refactors outside this issue scope
- New product scope (settlement, culture engine, logistics pass, history log)
- Closing GitHub issues from subagent self-report

---

## AutoVerify

Run all commands; paste output to parent orchestrator.

```bash
# From repo root on world-builder branch
git diff --name-only

# ESLint — every changed .js / .vue
npx eslint --max-warnings 0 <changed-files>

npm run test:world-builder -- world-builder/worldBuilderPageModel.test.js
npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js

# Line counts — production files touched
wc -l <changed-production-files>

rg '@world-builder/core' src/pages/projects/WorldBuilderPage.vue
```

---

## Acceptance criteria

Copied from GitHub issue body ([#368](https://github.com/enmaku/portfolio-site/issues/368)):

- [ ] SFC `<script setup>` contains no map lifecycle handles, worker imports, or generation orchestration.
- [ ] All `format*` display helpers consumed via page model or controller exports.
- [ ] Page line count reduced or unchanged with strictly less imports from core/renderer packages.
- [ ] `useWorldBuilderPageController.test.js` still passes; add tests if new controller exports appear.
- [ ] eslint clean on page + controller + model.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#368.1 … #368.6) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#368](https://github.com/enmaku/portfolio-site/issues/368)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | — |
| Blocks | #375, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
