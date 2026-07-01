# Issue #366 — Worker and clone round-trip for simulationRiverMask

> **GitHub:** [#366](https://github.com/enmaku/portfolio-site/issues/366)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#366](https://github.com/enmaku/portfolio-site/issues/366) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#364](https://github.com/enmaku/portfolio-site/issues/364)

### Blocks

- [#373](https://github.com/enmaku/portfolio-site/issues/373)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `worker-clone`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-366.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 366.1 — Audit worker step payloads for `simulationRiverMask`.
2. 366.2 — `cloneWorldDocument` deep copy — no shared buffers with presentation masks.
3. 366.3 — Test preview doc with meander on — simulation field retained.
4. 366.4 — `runDerivedGeographyInWorker.test.js` updated.

---

## Files MAY touch

- world-builder/core/cloneWorldDocument.js
- world-builder/worker/derivedGeographyWorkerProtocol.js
- world-builder/worker/derivedGeographyWorkerProtocol.test.js
- world-builder/runDerivedGeographyInWorker.test.js

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

npm run test:world-builder -- world-builder/worker/derivedGeographyWorkerProtocol.test.js
npm run test:world-builder -- world-builder/runDerivedGeographyInWorker.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#366](https://github.com/enmaku/portfolio-site/issues/366)):

- [ ] Worker protocol tests assert `simulationRiverMask` in validation/final payloads.
- [ ] `cloneWorldDocument` (or successor) deep-copies simulation mask independently from presentation masks.
- [ ] Preview documents applied to map during generation retain simulation field when presentation fields differ (meander on).
- [ ] Existing clone/worker tests pass; add coverage if gaps found.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#366.1 … #366.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#366](https://github.com/enmaku/portfolio-site/issues/366)

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
| Blocks | #373, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
