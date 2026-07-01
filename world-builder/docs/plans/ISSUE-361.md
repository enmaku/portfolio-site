# Issue #361 — Decompose derived geography pipeline orchestrator

> **GitHub:** [#361](https://github.com/enmaku/portfolio-site/issues/361)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#361](https://github.com/enmaku/portfolio-site/issues/361) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#359](https://github.com/enmaku/portfolio-site/issues/359)
- [#360](https://github.com/enmaku/portfolio-site/issues/360)

### Blocks

- [#370](https://github.com/enmaku/portfolio-site/issues/370)
- [#372](https://github.com/enmaku/portfolio-site/issues/372)
- [#374](https://github.com/enmaku/portfolio-site/issues/374)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)
- [#383](https://github.com/enmaku/portfolio-site/issues/383)
- [#384](https://github.com/enmaku/portfolio-site/issues/384)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `orchestrator-decompose`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/ORCHESTRATOR-DECOMPOSITION.md
6. world-builder/docs/FILE-SIZE-BUDGET.md
7. world-builder/docs/plans/ISSUE-361.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 361.1 — Extract clone helper to `cloneWorldDocument.js` (≤80 lines).
2. 361.2 — Extract world doc assembly to `buildWorldDocumentFromPipelineState.js` (≤70 lines).
3. 361.3 — Extract retry + hooks + step loop to `landmassPipelineRunner.js` (≤300 lines).
4. 361.4 — Slim `derivedGeographyPipeline.js` to re-exports + thin dispatch (≤650 lines).
5. 361.5 — Update worker + integration imports.
6. 361.6 — wc -l gate on all production files touched.
7. 361.7 — Full test suite green.

---

## Files MAY touch

- world-builder/core/derivedGeographyPipeline.js
- world-builder/core/cloneWorldDocument.js
- world-builder/core/buildWorldDocumentFromPipelineState.js
- world-builder/core/landmassPipelineRunner.js
- world-builder/worker/**
- world-builder/worldBuilder.integration.test.js
- world-builder/core/derivedGeographyPipeline.test.js

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

npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
npm run test:world-builder -- world-builder/worldBuilder.integration.test.js
npm run test:world-builder -- world-builder/worker/

# Line counts — production files touched
wc -l <changed-production-files>

wc -l world-builder/core/derivedGeographyPipeline.js
```

---

## Acceptance criteria

Copied from GitHub issue body ([#361](https://github.com/enmaku/portfolio-site/issues/361)):

- [ ] `derivedGeographyPipeline.js` (or renamed orchestrator) is under 650 lines.
- [ ] No production file introduced or enlarged past **1000 lines** by this decomposition.
- [ ] `generateDerivedGeography`, worker protocol, and page generation still work end-to-end.
- [ ] `derivedGeographyPipeline.test.js`, `worldBuilder.integration.test.js`, and worker tests pass.
- [ ] eslint clean on extracted modules.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#361.1 … #361.7) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#361](https://github.com/enmaku/portfolio-site/issues/361)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #359, #360 |
| Blocks | #370, #372, #374, #376, #383, #384 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
