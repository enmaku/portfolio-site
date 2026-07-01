# Issue #360 — Derive landmass stage contracts from stage modules

> **GitHub:** [#360](https://github.com/enmaku/portfolio-site/issues/360)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#360](https://github.com/enmaku/portfolio-site/issues/360) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

- [#359](https://github.com/enmaku/portfolio-site/issues/359)

### Blocks

- [#361](https://github.com/enmaku/portfolio-site/issues/361)
- [#371](https://github.com/enmaku/portfolio-site/issues/371)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `landmass-contract-derive`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/LANDMASS-STAGE-MODULES.md
6. world-builder/docs/HYDROLOGY-TYPED-STAGES.md
7. world-builder/docs/plans/ISSUE-360.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 360.1 — Implement `deriveLandmassStageContract(module)` mirroring hydrology pattern.
2. 360.2 — Replace manual `LANDMASS_PIPELINE_STAGE_CONTRACTS` object.
3. 360.3 — Replace `pickLandmassStageInput` switch with `selectLandmassStageInput(module, state)`.
4. 360.4 — Delete redundant JSDoc typedefs duplicating module inputs.
5. 360.5 — Update `landmassPipelineStageContracts.test.js` — test derivation, not parallel tables.
6. 360.6 — grep: no hand-maintained `inputKeys:` arrays outside derive function.
7. 360.7 — Mini arch: deletion test on old pickers.

---

## Files MAY touch

- world-builder/core/landmassPipelineStageContracts.js
- world-builder/core/landmassPipelineStageContracts.test.js
- world-builder/core/stages/**

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

npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js

# Line counts — production files touched
wc -l <changed-production-files>

rg 'inputKeys:' world-builder/core/ --glob '*.js' | rg -v derive
```

---

## Acceptance criteria

Copied from GitHub issue body ([#360](https://github.com/enmaku/portfolio-site/issues/360)):

- [ ] `LANDMASS_PIPELINE_STAGE_CONTRACTS` is computed from stage modules, not duplicated by hand.
- [ ] `pickLandmassStageInput` (or successor) uses module input selectors.
- [ ] `assertLandmassStageOutputs` validates against module `outputKeys`.
- [ ] `landmassPipelineStageContracts.test.js` updated to test derivation, not parallel tables.
- [ ] No duplicate contract definition surfaces remain for landmass stages.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#360.1 … #360.7) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#360](https://github.com/enmaku/portfolio-site/issues/360)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | #359 |
| Blocks | #361, #371, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
