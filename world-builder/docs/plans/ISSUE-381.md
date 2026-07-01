# Issue #381 — Manual QA checklist for World Builder Phase 5

> **GitHub:** [#381](https://github.com/enmaku/portfolio-site/issues/381)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#381](https://github.com/enmaku/portfolio-site/issues/381) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#379](https://github.com/enmaku/portfolio-site/issues/379)
- [#380](https://github.com/enmaku/portfolio-site/issues/380)

### Blocks

- [#382](https://github.com/enmaku/portfolio-site/issues/382)

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
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/plans/ISSUE-381.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 381.1 — Generate default world; map renders; pan/zoom; framing on regen.
2. 381.2 — Cancel mid-generation; UI recovers; no stuck progress.
3. 381.3 — Toggle each strategic resource overlay; no indeterminate checkbox.
4. 381.4 — Change arable envelope threshold; only arable overlay affected.
5. 381.5 — Change arable threshold; reload page; verify arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).
6. 381.6 — Change geography seed; regen; validation panel updates.
7. 381.7 — Reset defaults; overlay display settings restore.
8. 381.8 — Validation row map focus zooms expected region.
9. 381.9 — Exhausted validation run shows failure indicator without breaking map.
10. 381.10 — Record results in merge PR test plan.

---

## Files MAY touch

- *(none — audit / gate / docs-only slice)*

---

## Files MUST NOT touch

- Production code — manual QA only

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

npx quasar dev — manual at http://localhost:9000/#/projects/world-builder

# Line counts — production files touched
wc -l <changed-production-files>
```

---

## Acceptance criteria

Copied from GitHub issue body ([#381](https://github.com/enmaku/portfolio-site/issues/381)):

- [ ] Generate default world; map renders; pan/zoom works; framing preserved on regen.
- [ ] Cancel mid-generation; UI returns to cancellable state; no stuck progress bar.
- [ ] Toggle each strategic resource overlay on/off; no indeterminate checkbox; no visible stutter on 256²+ grid if available.
- [ ] Change arable envelope threshold; only arable overlay affected visually.
- [ ] Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).
- [ ] Change geography seed; regen; validation panel updates.
- [ ] Reset defaults; overlay display settings restore.
- [ ] Validation row map focus zooms/focuses expected region.
- [ ] Exhausted validation run shows failure indicator without breaking map.
- [ ] Results checked off in PR test plan.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#381.1 … #381.10) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#381](https://github.com/enmaku/portfolio-site/issues/381)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #379, #380 |
| Blocks | #382 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
