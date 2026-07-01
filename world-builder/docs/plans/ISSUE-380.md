# Issue #380 — Architecture dry-run PR self-review (PR-scoped)

> **GitHub:** [#380](https://github.com/enmaku/portfolio-site/issues/380)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#380](https://github.com/enmaku/portfolio-site/issues/380) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#377](https://github.com/enmaku/portfolio-site/issues/377)
- [#378](https://github.com/enmaku/portfolio-site/issues/378)

### Blocks

- [#381](https://github.com/enmaku/portfolio-site/issues/381)

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
5. world-builder/docs/ARCHITECTURE-SEAMS.md
6. world-builder/docs/plans/ISSUE-380.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 380.1 — Run PR-scoped architecture dry-run (max 3 deepening items).
2. 380.2 — Verify three Strong deepenings: hydrology modules, vector locality, derived contracts.
3. 380.3 — Document deletion-test narrative in PR body.
4. 380.4 — Resolve or accept any Strong findings with written rationale.

---

## Files MAY touch

- *(none — audit / gate / docs-only slice)*

---

## Files MUST NOT touch

- Code changes unless dry-run findings require fixes

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
```

---

## Acceptance criteria

Copied from GitHub issue body ([#380](https://github.com/enmaku/portfolio-site/issues/380)):

- [ ] Hydrology modules pass deletion test (complexity concentrates in modules, not bags).
- [ ] Landmass contracts derived from modules.
- [ ] Overlay owner → viewport seam has raster **and** vector locality.
- [ ] Simulation vs presentation hydrology seam clear for logistics pass.
- [ ] No merge-blocking architecture findings remain.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#380.1 … #380.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#380](https://github.com/enmaku/portfolio-site/issues/380)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #377, #378 |
| Blocks | #381 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
