# Subagent prompt — Issue #355

> Copy-paste this entire file to launch an **implementer** subagent for [#355](https://github.com/enmaku/portfolio-site/issues/355).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#355](https://github.com/enmaku/portfolio-site/issues/355) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-355.md](../plans/ISSUE-355.md) specify.

---

## Issue

- **Title:** Hydrology typed stage outputs (eliminate god-bag world)
- **Link:** [#355](https://github.com/enmaku/portfolio-site/issues/355)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `hydrology-type` (MINI-REVIEW-RUBRICS.md)

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

## Scope boundary

### Files you MAY touch

- world-builder/core/hydrology/hydrologyWorldTypes.js
- world-builder/core/hydrology/substeps/moduleTypes.js
- world-builder/core/hydrology/hydrologySubsteps.js
- world-builder/core/hydrology/buildPipelineStateFromHydrologyWorld.js
- world-builder/core/hydrology/hydrologySubstepContracts.js
- world-builder/core/hydrology/hydrologySubstepModules.js
- world-builder/core/hydrology/hydrologySubsteps.test.js
- world-builder/core/hydrology/hydrologySubstepContracts.test.js

### Files you MUST NOT touch

- world-builder/renderer/**
- src/pages/projects/WorldBuilderPage.vue
- world-builder/core/derivedGeographyPipeline.js

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-355.md](../plans/ISSUE-355.md):

1. 355.1 — Create `hydrologyWorldTypes.js` with staged typedefs and `createInitialHydrologyWorld`; zero `Record<string, unknown>`.
2. 355.2 — Redefine `HydrologySubstepModule` in `substeps/moduleTypes.js` with typed generics; no `any` on public `run`.
3. 355.3 — Update `selectHydrologySubstepInput` to use narrow selectors at module boundaries.
4. 355.4 — Refactor runner in `hydrologySubsteps.js` to fold typed stages; keep skip paths and defaults.
5. 355.5 — Extract `buildPipelineStateFromHydrologyWorld.js`; input type is `HydrologyAfterPaint`.
6. 355.6 — Fix contract derivation for pipeline-mutated mask keys; keep derived-only contracts.
7. 355.7 — Remove god-bag typedef from legacy modules file; grep gate clean.
8. 355.8 — Parent integration: full `npm run test:world-builder`; eslint on all touched files.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js
npm run test:world-builder
wc -l <changed-production-files>
rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'
```

Self-check against **MINI-REVIEW-RUBRICS.md § `hydrology-type`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] No `HydrologyWorld & Record<string, unknown>` (or equivalent god-bag) remains in the hydrology runner composition.
- [ ] Each substep module's `inputs` selectors and `run` function are typed against explicit stage types (no `Record<string, any>` on the public substep interface).
- [ ] `selectHydrologySubstepInput` (or successor) is type-safe at the module boundary.
- [ ] `buildPipelineStateFromHydrologyWorld` (or successor) reads only typed stage outputs.
- [ ] `hydrologySubstepContracts` remains derived from module metadata without a parallel manual key table.
- [ ] `npm run test:world-builder` passes; eslint clean on changed files.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `hydrology-type` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #355. MINI-REVIEW-RUBRICS.md § `hydrology-type`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-355.md](../plans/ISSUE-355.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
