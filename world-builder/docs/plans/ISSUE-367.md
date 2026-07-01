# Issue #367 — Resource overlay checkbox toggle and indeterminate state

> **GitHub:** [#367](https://github.com/enmaku/portfolio-site/issues/367)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#367](https://github.com/enmaku/portfolio-site/issues/367) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).

### Blocks

- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `checkbox-ux`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
6. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
7. world-builder/docs/plans/ISSUE-367.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 367.1 — Reproduce: document exact Quasar props causing indeterminate state.
2. 367.2 — Normalize booleans in overlay owner before commit.
3. 367.3 — Fix SFC bindings — no tri-state `:model-value`.
4. 367.4 — Seam test: on→off === false (no copy assertions).
5. 367.5 — Manual repro steps in issue comment (for #381).

---

## Files MAY touch

- src/pages/projects/WorldBuilderPage.vue
- world-builder/resourceOverlayState.js
- world-builder/resourceOverlayState.test.js
- src/composables/useWorldBuilderOverlayState.js
- world-builder/worldBuilderOverlayControls.js

---

## Files MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/core/derivedGeographyPipeline.js

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

npm run test:world-builder -- world-builder/resourceOverlayState.test.js
npm run test:world-builder -- world-builder/worldBuilderOverlayControls.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#367](https://github.com/enmaku/portfolio-site/issues/367)):

- [ ] Manual repro fixed: check overlay → uncheck overlay returns to unchecked (not indeterminate dash).
- [ ] `:model-value` binding uses boolean from overlay owner without tri-state leakage.
- [ ] If `null`/`undefined` can appear in visibility map, normalize in overlay owner before commit.
- [ ] Behavioral test at overlay composable or page-controller seam if feasible without copy assertions (state contract test).
- [ ] No user-facing copy assertions in tests.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#367.1 … #367.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#367](https://github.com/enmaku/portfolio-site/issues/367)

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
| Blocks | #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
