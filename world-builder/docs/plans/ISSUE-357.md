# Issue #357 — Hydrology flow-field recompute invariants after typing refactor

> **GitHub:** [#357](https://github.com/enmaku/portfolio-site/issues/357)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#357](https://github.com/enmaku/portfolio-site/issues/357) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#355](https://github.com/enmaku/portfolio-site/issues/355)
- [#356](https://github.com/enmaku/portfolio-site/issues/356)

### Blocks

- [#371](https://github.com/enmaku/portfolio-site/issues/371)
- [#374](https://github.com/enmaku/portfolio-site/issues/374)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `regression-guard`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/FLOW-FIELD-INVARIANTS.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-357.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 357.1 — Document in test comments the three full-solve stages: route, extract, settle.
2. 357.2 — Assert `fullFlowSolveCount === 3` for default generation in `derivedGeographyPipeline.test.js`.
3. 357.3 — Assert `solveLog` entries match documented stage/reason labels.
4. 357.4 — Seasonal hydrology enabled: assert no additional full solves vs baseline.
5. 357.5 — Mini thermo: no hidden full solve in substep delegate without log entry.

---

## Files MAY touch

- world-builder/core/derivedGeographyPipeline.test.js
- world-builder/core/hydrology/**/*.test.js

---

## Files MUST NOT touch

- world-builder/renderer/**
- src/pages/**

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

npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
npm run test:world-builder -- world-builder/core/hydrology/

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#357](https://github.com/enmaku/portfolio-site/issues/357)):

- [ ] Default derived-geography generation still performs exactly **three** full flow solves (or the currently documented invariant—update tests only if behavior was wrong).
- [ ] `flowFieldSession.solveLog` entries retain stage/reason labels used by generation report.
- [ ] Enabling seasonal hydrology does not accidentally add silent full solves.
- [ ] `derivedGeographyPipeline.test.js` and hydrology substep tests covering flow counts pass.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#357.1 … #357.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#357](https://github.com/enmaku/portfolio-site/issues/357)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #355, #356 |
| Blocks | #371, #374, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
