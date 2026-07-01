# Issue #376 — Phase 5 branch commit hygiene on world-builder

> **GitHub:** [#376](https://github.com/enmaku/portfolio-site/issues/376)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#376](https://github.com/enmaku/portfolio-site/issues/376) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#355](https://github.com/enmaku/portfolio-site/issues/355)
- [#356](https://github.com/enmaku/portfolio-site/issues/356)
- [#357](https://github.com/enmaku/portfolio-site/issues/357)
- [#358](https://github.com/enmaku/portfolio-site/issues/358)
- [#359](https://github.com/enmaku/portfolio-site/issues/359)
- [#360](https://github.com/enmaku/portfolio-site/issues/360)
- [#361](https://github.com/enmaku/portfolio-site/issues/361)
- [#362](https://github.com/enmaku/portfolio-site/issues/362)
- [#363](https://github.com/enmaku/portfolio-site/issues/363)
- [#364](https://github.com/enmaku/portfolio-site/issues/364)
- [#365](https://github.com/enmaku/portfolio-site/issues/365)
- [#366](https://github.com/enmaku/portfolio-site/issues/366)
- [#367](https://github.com/enmaku/portfolio-site/issues/367)
- [#368](https://github.com/enmaku/portfolio-site/issues/368)
- [#369](https://github.com/enmaku/portfolio-site/issues/369)
- [#370](https://github.com/enmaku/portfolio-site/issues/370)
- [#371](https://github.com/enmaku/portfolio-site/issues/371)
- [#372](https://github.com/enmaku/portfolio-site/issues/372)
- [#373](https://github.com/enmaku/portfolio-site/issues/373)
- [#374](https://github.com/enmaku/portfolio-site/issues/374)
- [#375](https://github.com/enmaku/portfolio-site/issues/375)
- [#383](https://github.com/enmaku/portfolio-site/issues/383)
- [#384](https://github.com/enmaku/portfolio-site/issues/384)
- [#385](https://github.com/enmaku/portfolio-site/issues/385)
- [#386](https://github.com/enmaku/portfolio-site/issues/386)

### Blocks

- [#377](https://github.com/enmaku/portfolio-site/issues/377)
- [#378](https://github.com/enmaku/portfolio-site/issues/378)

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
5. world-builder/docs/COMMIT-SLICE-MAP.md
6. world-builder/docs/MERGE-GATES.md
7. world-builder/docs/plans/ISSUE-376.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 376.1 — Group commits per COMMIT-SLICE-MAP (hydrology, landmass, overlay, tests, glossary).
2. 376.2 — Maintainer performs commits (agent hooks block autonomous commit).
3. 376.3 — Push branch to origin.
4. 376.4 — Verify `git status` clean; no orphaned deleted test files.

---

## Files MAY touch

- *(none — audit / gate / docs-only slice)*

---

## Files MUST NOT touch

- No code changes — git hygiene only (maintainer commits)

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

git status
git log --oneline -20

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#376](https://github.com/enmaku/portfolio-site/issues/376)):

- [ ] `git status` clean after Phase 5 implementation.
- [ ] Commits grouped by slice (not one giant commit, not 50 one-line commits).
- [ ] Commit messages reference issue numbers where helpful.
- [ ] Branch pushed to origin before PR.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#376.1 … #376.4) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #355, #356, #357, #358, #359, #360, #361, #362, #363, #364, #365, #366, #367, #368, #369, #370, #371, #372, #373, #374, #375, #383, #384, #385, #386 |
| Blocks | #377, #378 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
