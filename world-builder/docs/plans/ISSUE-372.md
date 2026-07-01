# Issue #372 — Production file size audit (no file over 1000 lines)

> **GitHub:** [#372](https://github.com/enmaku/portfolio-site/issues/372)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#372](https://github.com/enmaku/portfolio-site/issues/372) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#356](https://github.com/enmaku/portfolio-site/issues/356)
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
5. world-builder/docs/FILE-SIZE-BUDGET.md
6. world-builder/docs/MERGE-GATES.md
7. world-builder/docs/plans/ISSUE-372.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 372.1 — List all production `.js`/`.vue` on branch — flag >600, >800, >1000 lines.
2. 372.2 — Any >1000: split or justify in PR body.
3. 372.3 — Confirm orchestrator ≤650, hydrology registry ≤80, substep files ≤250.
4. 372.4 — Summarize audit in merge PR body template.

---

## Files MAY touch

- *(none — audit / gate / docs-only slice)*

---

## Files MUST NOT touch

- All production code — audit only unless split required

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

npm run test:world-builder

# Line counts — production files touched
wc -l <changed-production-files>

find world-builder -name '*.js' -not -path '*/test*' -not -name '*.test.js' -exec wc -l {} + | sort -n | tail -20
```

---

## Acceptance criteria

Copied from GitHub issue body ([#372](https://github.com/enmaku/portfolio-site/issues/372)):

- [ ] No production `.js`/`.vue` file on the branch exceeds 1000 lines without explicit PR justification.
- [ ] `hydrologySubstepModules` monolith eliminated (see #356).
- [ ] `derivedGeographyPipeline` orchestrator under 650 lines (see #361).
- [ ] `worldBuilderGenerationControls` metadata either accepted under limit or split by control section if over threshold.
- [ ] Audit result summarized in merge PR body.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#372.1 … #372.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#372](https://github.com/enmaku/portfolio-site/issues/372)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #356, #361 |
| Blocks | #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
