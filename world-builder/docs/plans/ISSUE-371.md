# Issue #371 — Collapse redundant hydrology and landmass contract test duplication

> **GitHub:** [#371](https://github.com/enmaku/portfolio-site/issues/371)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#371](https://github.com/enmaku/portfolio-site/issues/371) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#357](https://github.com/enmaku/portfolio-site/issues/357)
- [#358](https://github.com/enmaku/portfolio-site/issues/358)
- [#360](https://github.com/enmaku/portfolio-site/issues/360)
- [#361](https://github.com/enmaku/portfolio-site/issues/361)

### Blocks

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
5. world-builder/docs/SEAM-TEST-CATALOG.md
6. world-builder/docs/plans/ISSUE-371.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 371.1 — List tests that only assert key list parity.
2. 371.2 — Delete redundant; keep one derive test per pipeline.
3. 371.3 — Test count may decrease; behavior coverage same or better.
4. 371.4 — Run full hydrology + landmass contract integration tests.

---

## Files MAY touch

- world-builder/core/hydrology/hydrologySubstepContracts.test.js
- world-builder/core/landmassPipelineStageContracts.test.js

---

## Files MUST NOT touch

- world-builder/renderer/**

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

npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js
npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js
npm run test:world-builder

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#371](https://github.com/enmaku/portfolio-site/issues/371)):

- [ ] No test file exists solely to assert contract key lists mirror module metadata (one derivation test per pipeline is enough).
- [ ] `hydrologySubstepContracts.test.js` and `landmassPipelineStageContracts.test.js` focus on integration invariants, not parallel tables.
- [ ] Test count may decrease; behavior coverage must not.
- [ ] `npm run test:world-builder` passes.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#371.1 … #371.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#371](https://github.com/enmaku/portfolio-site/issues/371)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #357, #358, #360, #361 |
| Blocks | #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
