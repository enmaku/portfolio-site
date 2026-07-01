# Issue #358 — RiverMaskPipeline lifecycle invariants after hydrology refactor

> **GitHub:** [#358](https://github.com/enmaku/portfolio-site/issues/358)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#358](https://github.com/enmaku/portfolio-site/issues/358) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

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
5. world-builder/docs/RIVER-MASK-LIFECYCLE.md
6. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
7. world-builder/docs/plans/ISSUE-358.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 358.1 — Snapshot tests: stage order sketch→incised→settled→presentation→painted.
2. 358.2 — `skipRefine` transition test unchanged.
3. 358.3 — `enableMeanderRefine: true` → presentation masks change; `simulationRiverMask` byte-equal.
4. 358.4 — `riverAttractionRadiusScale` opt-in → same byte-invariance on simulation mask.
5. 358.5 — Assert `simulationRiverMask` source = settled stage via public API only.

---

## Files MAY touch

- world-builder/core/hydrology/**/*.test.js
- world-builder/core/hydrology/riverMaskLifecycle.test.js

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

npm run test:world-builder -- world-builder/core/hydrology/riverMaskLifecycle.test.js
npm run test:world-builder -- world-builder/core/hydrology/

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#358](https://github.com/enmaku/portfolio-site/issues/358)):

- [ ] Mask lifecycle snapshots in hydrology tests still match stage order with defaults off (skipRefine transition).
- [ ] `simulationRiverMask` on pipeline/world document still comes from settled simulation centerline, not presentation refine.
- [ ] Opt-in `enableMeanderRefine` changes presentation masks only; `simulationRiverMask` byte-identical vs default.
- [ ] Opt-in `riverAttractionRadiusScale` changes presentation only; `simulationRiverMask` byte-identical vs default.
- [ ] `riverMaskLifecycle.test.js` and hydrology seam contract tests pass.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#358.1 … #358.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#358](https://github.com/enmaku/portfolio-site/issues/358)

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
