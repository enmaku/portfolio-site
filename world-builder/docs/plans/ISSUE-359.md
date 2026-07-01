# Issue #359 — Landmass pipeline stage modules (derived geography steps)

> **GitHub:** [#359](https://github.com/enmaku/portfolio-site/issues/359)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#359](https://github.com/enmaku/portfolio-site/issues/359) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).

### Blocks

- [#360](https://github.com/enmaku/portfolio-site/issues/360)
- [#361](https://github.com/enmaku/portfolio-site/issues/361)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `landmass-module`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/LANDMASS-STAGE-MODULES.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-359.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 359.1 — Create `stages/physicalTerrainBaselineStage.js` from baseline step body.
2. 359.2 — Create `stages/erosionStage.js`.
3. 359.3 — Create `stages/hydrologyStage.js` (delegate to hydrology runner).
4. 359.4 — Create `stages/fieldRefreshStage.js`.
5. 359.5 — Create `stages/coastAndResourcesStage.js`.
6. 359.6 — Create `stages/validationStage.js`.
7. 359.7 — Create `landmassPipelineStageModules.js` ordered registry.
8. 359.8 — Replace `executeLandmassPipelineStage` switch with module loop.
9. 359.9 — `runLandmassPipeline.test.js` + `derivedGeographyPipeline.test.js` green.

---

## Files MAY touch

- world-builder/core/stages/**
- world-builder/core/landmassPipelineStageModules.js
- world-builder/core/derivedGeographyPipeline.js
- world-builder/core/runLandmassPipeline.test.js
- world-builder/core/derivedGeographyPipeline.test.js

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

npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js
npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#359](https://github.com/enmaku/portfolio-site/issues/359)):

- [ ] Each landmass pipeline stage has a module object colocated with or adjacent to its implementation.
- [ ] Stage modules export `id`, `label`, `inputs`, `outputKeys`, and `run` (or documented equivalent).
- [ ] `runPipelineStep` dispatches through stage modules instead of a large switch with ad-hoc pickers.
- [ ] No behavior change for default generation and validation exhausted path.
- [ ] `runLandmassPipeline.test.js` and `derivedGeographyPipeline.test.js` pass.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#359.1 … #359.9) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#359](https://github.com/enmaku/portfolio-site/issues/359)

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
| Blocks | #360, #361, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
