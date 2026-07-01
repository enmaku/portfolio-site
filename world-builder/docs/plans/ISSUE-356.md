# Issue #356 — Split hydrology substep modules into per-substep files

> **GitHub:** [#356](https://github.com/enmaku/portfolio-site/issues/356)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#356](https://github.com/enmaku/portfolio-site/issues/356) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#355](https://github.com/enmaku/portfolio-site/issues/355)

### Blocks

- [#357](https://github.com/enmaku/portfolio-site/issues/357)
- [#358](https://github.com/enmaku/portfolio-site/issues/358)
- [#372](https://github.com/enmaku/portfolio-site/issues/372)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `hydrology-file-split`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/HYDROLOGY-SUBSTEP-FILE-MAP.md
6. world-builder/docs/HYDROLOGY-TYPED-STAGES.md
7. world-builder/docs/hydrology/substep-specs/SUBSTEP-hydrologyFill.md
8. world-builder/docs/plans/ISSUE-356.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 356.1 — Extract `substeps/hydrologyFillSubstep.js` (≤250 lines).
2. 356.2 — Extract `substeps/hydrologyClimateSubstep.js` (≤200 lines).
3. 356.3 — Extract `substeps/hydrologySeasonalSubstep.js` (≤200 lines).
4. 356.4 — Extract `substeps/hydrologyRouteSubstep.js` (≤250 lines).
5. 356.5 — Extract `substeps/hydrologyInciseSubstep.js` (≤200 lines).
6. 356.6 — Extract `substeps/hydrologyExtractSubstep.js` (≤200 lines).
7. 356.7 — Extract `substeps/hydrologyRefineSubstep.js` (≤200 lines).
8. 356.8 — Extract `substeps/hydrologySettleSubstep.js` (≤250 lines).
9. 356.9 — Extract `substeps/hydrologyPaintSubstep.js` (≤250 lines).
10. 356.10 — Create `substeps/index.js` registry (≤80 lines, import-only).
11. 356.11 — Extract `baselineDrainageFromState.js` helper (≤60 lines).
12. 356.12 — Delete monolithic `hydrologySubstepModules.js`; shim re-export only if required.
13. 356.13 — Update imports repo-wide; `rg hydrologySubstepModules` hits zero except changelog.

---

## Files MAY touch

- world-builder/core/hydrology/substeps/**
- world-builder/core/hydrology/hydrologySubstepModules.js
- world-builder/core/hydrology/baselineDrainageFromState.js
- world-builder/core/hydrology/hydrologySubsteps.test.js
- world-builder/core/hydrology/hydrologySubstepModules.test.js

---

## Files MUST NOT touch

- world-builder/renderer/**
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

npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepModules.test.js
npm run test:world-builder

# Line counts — production files touched
wc -l <changed-production-files>

wc -l world-builder/core/hydrology/substeps/*.js
```

---

## Acceptance criteria

Copied from GitHub issue body ([#356](https://github.com/enmaku/portfolio-site/issues/356)):

- [ ] Nine substep implementations live in dedicated files; registry is import-only.
- [ ] All existing hydrology substep behavior tests pass unchanged in outcome (update imports only as needed).
- [ ] `hydrologySubsteps.test.js` and `hydrologySubstepModules.test.js` remain green.
- [ ] eslint clean on all new/changed hydrology files.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#356.1 … #356.13) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#356](https://github.com/enmaku/portfolio-site/issues/356)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #355 |
| Blocks | #357, #358, #372, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
