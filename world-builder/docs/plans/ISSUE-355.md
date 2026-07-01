# Issue #355 — Hydrology typed stage outputs (eliminate god-bag world)

> **GitHub:** [#355](https://github.com/enmaku/portfolio-site/issues/355)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#355](https://github.com/enmaku/portfolio-site/issues/355) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).

### Blocks

- [#356](https://github.com/enmaku/portfolio-site/issues/356)
- [#357](https://github.com/enmaku/portfolio-site/issues/357)
- [#358](https://github.com/enmaku/portfolio-site/issues/358)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `hydrology-type`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/HYDROLOGY-TYPED-STAGES.md
6. world-builder/docs/RIVER-MASK-LIFECYCLE.md
7. world-builder/docs/FLOW-FIELD-INVARIANTS.md
8. world-builder/docs/plans/ISSUE-355.md

---

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 355.1 — Create `hydrologyWorldTypes.js` with staged typedefs and `createInitialHydrologyWorld`; zero `Record<string, unknown>`.
2. 355.2 — Redefine `HydrologySubstepModule` in `substeps/moduleTypes.js` with typed generics; no `any` on public `run`.
3. 355.3 — Update `selectHydrologySubstepInput` to use narrow selectors at module boundaries.
4. 355.4 — Refactor runner in `hydrologySubsteps.js` to fold typed stages; keep skip paths and defaults.
5. 355.5 — Extract `buildPipelineStateFromHydrologyWorld.js`; input type is `HydrologyAfterPaint`.
6. 355.6 — Fix contract derivation for pipeline-mutated mask keys; keep derived-only contracts.
7. 355.7 — Remove god-bag typedef from legacy modules file; grep gate clean.
8. 355.8 — Parent integration: full `npm run test:world-builder`; eslint on all touched files.

---

## Files MAY touch

- world-builder/core/hydrology/hydrologyWorldTypes.js
- world-builder/core/hydrology/substeps/moduleTypes.js
- world-builder/core/hydrology/hydrologySubsteps.js
- world-builder/core/hydrology/buildPipelineStateFromHydrologyWorld.js
- world-builder/core/hydrology/hydrologySubstepContracts.js
- world-builder/core/hydrology/hydrologySubstepModules.js
- world-builder/core/hydrology/hydrologySubsteps.test.js
- world-builder/core/hydrology/hydrologySubstepContracts.test.js

---

## Files MUST NOT touch

- world-builder/renderer/**
- src/pages/projects/WorldBuilderPage.vue
- world-builder/core/derivedGeographyPipeline.js

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

npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js
npm run test:world-builder

# Line counts — production files touched
wc -l <changed-production-files>

rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'
```

---

## Acceptance criteria

Copied from GitHub issue body ([#355](https://github.com/enmaku/portfolio-site/issues/355)):

- [ ] No `HydrologyWorld & Record<string, unknown>` (or equivalent god-bag) remains in the hydrology runner composition.
- [ ] Each substep module's `inputs` selectors and `run` function are typed against explicit stage types (no `Record<string, any>` on the public substep interface).
- [ ] `selectHydrologySubstepInput` (or successor) is type-safe at the module boundary.
- [ ] `buildPipelineStateFromHydrologyWorld` (or successor) reads only typed stage outputs.
- [ ] `hydrologySubstepContracts` remains derived from module metadata without a parallel manual key table.
- [ ] `npm run test:world-builder` passes; eslint clean on changed files.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#355.1 … #355.8) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#355](https://github.com/enmaku/portfolio-site/issues/355)

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
| Blocks | #356, #357, #358, #376 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
