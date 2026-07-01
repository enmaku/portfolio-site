# Issue #365 — Validation and generation report consume simulation river interface

> **GitHub:** [#365](https://github.com/enmaku/portfolio-site/issues/365)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#365](https://github.com/enmaku/portfolio-site/issues/365) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#364](https://github.com/enmaku/portfolio-site/issues/364)

### Blocks

- [#370](https://github.com/enmaku/portfolio-site/issues/370)
- [#373](https://github.com/enmaku/portfolio-site/issues/373)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)
- [#386](https://github.com/enmaku/portfolio-site/issues/386)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `simulation-consumer`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-365.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 365.1 — Trace validation river/navigability inputs; document in issue comment.
2. 365.2 — Switch to `simulationRiverMask` for `assembleRiverNetwork` where logistics metrics.
3. 365.3 — Generation report hydrology section uses simulation graph.
4. 365.4 — Test: meander on → validation metrics unchanged.
5. 365.5 — `runGeographyValidationChecks.test.js` green.

---

## Files MAY touch

- world-builder/core/validation/runGeographyValidationChecks.js
- world-builder/core/validation/runGeographyValidationChecks.test.js
- world-builder/core/buildGenerationReport.js
- world-builder/core/buildGenerationReport.test.js

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

npm run test:world-builder -- world-builder/core/validation/runGeographyValidationChecks.test.js
npm run test:world-builder -- world-builder/core/buildGenerationReport.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#365](https://github.com/enmaku/portfolio-site/issues/365)):

- [ ] Validation slice assembly passes simulation centerline into `assembleRiverNetwork` (or equivalent) when computing navigability metrics.
- [ ] Generation report hydrology metrics (mouth count, navigable km, Hacks law, etc.) derive from simulation graph/mask.
- [ ] Presentation-only option toggles do not change validation outcomes for checks that are physics-facing.
- [ ] Tests prove validation metrics invariant when only presentation meander/attraction is enabled.
- [ ] `runGeographyValidationChecks.test.js` and pipeline validation tests pass.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#365.1 … #365.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#365](https://github.com/enmaku/portfolio-site/issues/365)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #364 |
| Blocks | #370, #373, #376, #386 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
