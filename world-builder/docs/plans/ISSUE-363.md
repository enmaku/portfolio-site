# Issue #363 — Vector overlay refresh locality behavioral tests

> **GitHub:** [#363](https://github.com/enmaku/portfolio-site/issues/363)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#363](https://github.com/enmaku/portfolio-site/issues/363) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#362](https://github.com/enmaku/portfolio-site/issues/362)

### Blocks

- [#369](https://github.com/enmaku/portfolio-site/issues/369)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)
- [#385](https://github.com/enmaku/portfolio-site/issues/385)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `overlay-vector-test`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-363.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 363.1 — Test: arable+timber+metals+salt rasters on; toggle salt nodes only → raster RGBA build 0.
2. 363.2 — Test: coastal present; toggle salt only → coastal draw count unchanged.
3. 363.3 — Test: toggle metals nodes only → salt and coastal unchanged.
4. 363.4 — Extend harness: per-layer spy (`drawnCirclesByLayer` or equivalent).
5. 363.5 — No source-grep or import-ban assertions.

---

## Files MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js
- world-builder/renderer/createWorldBuilderMapViewport.*.test.js

---

## Files MUST NOT touch

- world-builder/core/**

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

npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#363](https://github.com/enmaku/portfolio-site/issues/363)):

- [ ] Test: enable arable+timber+metals+salt rasters, then toggle salt nodes only—resource raster RGBA build count stays 0.
- [ ] Test: coastal nodes present; toggle salt only—coastal draw count unchanged (or coastal layer not refreshed).
- [ ] Test: toggle metals nodes only—salt and coastal unchanged.
- [ ] Tests run under `npm run test:world-builder` (with module mocks), not skipped.
- [ ] No source-grep or import-ban assertions.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#363.1 … #363.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#363](https://github.com/enmaku/portfolio-site/issues/363)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #362 |
| Blocks | #369, #376, #385 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
