# Issue #370 — ADR-0009 renderer and generation seam behavioral audit

> **GitHub:** [#370](https://github.com/enmaku/portfolio-site/issues/370)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#370](https://github.com/enmaku/portfolio-site/issues/370) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#361](https://github.com/enmaku/portfolio-site/issues/361)
- [#363](https://github.com/enmaku/portfolio-site/issues/363)
- [#365](https://github.com/enmaku/portfolio-site/issues/365)

### Blocks

- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `audit-adr`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-370.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 370.1 — rg generation path for renderer imports — must be 0.
2. 370.2 — Complete `rendererSeamContract.test.js` behavioral coverage.
3. 370.3 — Complete `worldBuilderGenerationSeamContract.test.js`.
4. 370.4 — Complete `resourceOverlayStateSeamContract.test.js`.
5. 370.5 — Findings list → PR test plan section (not new ad-hoc docs).

---

## Files MAY touch

- world-builder/**/*SeamContract*.test.js
- world-builder/renderer/rendererSeamContract.test.js
- world-builder/worldBuilderGenerationSeamContract.test.js
- world-builder/resourceOverlayStateSeamContract.test.js

---

## Files MUST NOT touch

- world-builder/core/hydrology/substeps/**

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

npm run test:world-builder -- world-builder/renderer/rendererSeamContract.test.js
npm run test:world-builder -- world-builder/worldBuilderGenerationSeamContract.test.js
npm run test:world-builder -- world-builder/resourceOverlayStateSeamContract.test.js

# Line counts — production files touched
wc -l <changed-production-files>

rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test
```

---

## Acceptance criteria

Copied from GitHub issue body ([#370](https://github.com/enmaku/portfolio-site/issues/370)):

- [ ] `useWorldBuilderGeneration`, orchestrator, and worker modules have no imports from renderer package.
- [ ] `rendererSeamContract.test.js` covers displayBiomes terrain, presentation river overlay, and biome/presentation separation behaviorally.
- [ ] `worldBuilderGenerationSeamContract.test.js` proves generation completes without viewport.
- [ ] `resourceOverlayStateSeamContract.test.js` proves owner-only viewport mutation path.
- [ ] No `readFileSync` source greps in world-builder runtime seam tests (research asset tests exempt).
- [ ] Audit findings documented in PR test plan (not new repo docs unless glossary update needed).

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#370.1 … #370.5) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#370](https://github.com/enmaku/portfolio-site/issues/370)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #361, #363, #365 |
| Blocks | #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
