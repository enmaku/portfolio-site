# Issue #384 — Generation cancel and stale-run regression guard

> **GitHub:** [#384](https://github.com/enmaku/portfolio-site/issues/384)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#384](https://github.com/enmaku/portfolio-site/issues/384) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#361](https://github.com/enmaku/portfolio-site/issues/361)
- [#375](https://github.com/enmaku/portfolio-site/issues/375)

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
6. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
7. world-builder/docs/plans/ISSUE-384.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 384.1 — Run `worldBuilderGenerationCancel.test.js`.
2. 384.2 — Run orchestrator stale-run and cancel tests.
3. 384.3 — Verify page controller destroy cancels active run.
4. 384.4 — Assert no duplicate world-document apply from stale worker after rapid regenerate.

---

## Files MAY touch

- world-builder/worldBuilderGenerationCancel.test.js
- world-builder/worldBuilderGenerationOrchestrator.test.js
- src/composables/useWorldBuilderPageController.test.js

---

## Files MUST NOT touch

- world-builder/core/hydrology/**

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

npm run test:world-builder -- world-builder/worldBuilderGenerationCancel.test.js
npm run test:world-builder -- world-builder/worldBuilderGenerationOrchestrator.test.js
npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#384](https://github.com/enmaku/portfolio-site/issues/384)):

- [ ] `worldBuilderGenerationCancel.test.js` passes.
- [ ] `worldBuilderGenerationOrchestrator.test.js` stale-run and cancel tests pass.
- [ ] Page controller destroy cancels active run (controller test).
- [ ] No duplicate world-document apply from stale worker after rapid regenerate.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#384.1 … #384.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#384](https://github.com/enmaku/portfolio-site/issues/384)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #361, #375 |
| Blocks | #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
