# Subagent prompt — Issue #359

> Copy-paste this entire file to launch an **implementer** subagent for [#359](https://github.com/enmaku/portfolio-site/issues/359).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#359](https://github.com/enmaku/portfolio-site/issues/359) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-359.md](../plans/ISSUE-359.md) specify.

---

## Issue

- **Title:** Landmass pipeline stage modules (derived geography steps)
- **Link:** [#359](https://github.com/enmaku/portfolio-site/issues/359)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `landmass-module` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/LANDMASS-STAGE-MODULES.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-359.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/stages/**
- world-builder/core/landmassPipelineStageModules.js
- world-builder/core/derivedGeographyPipeline.js
- world-builder/core/runLandmassPipeline.test.js
- world-builder/core/derivedGeographyPipeline.test.js

### Files you MUST NOT touch

- world-builder/renderer/**
- src/pages/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-359.md](../plans/ISSUE-359.md):

1. 359.1 — Create `stages/physicalTerrainBaselineStage.js` from baseline step body.
2. 359.2 — Create `stages/erosionStage.js`.
3. 359.3 — Create `stages/hydrologyStage.js` (delegate to hydrology runner).
4. 359.4 — Create `stages/fieldRefreshStage.js`.
5. 359.5 — Create `stages/coastAndResourcesStage.js`.
6. 359.6 — Create `stages/validationStage.js`.
7. 359.7 — Create `landmassPipelineStageModules.js` ordered registry.
8. 359.8 — Replace `executeLandmassPipelineStage` switch with module loop.
9. 359.9 — `runLandmassPipeline.test.js` + `derivedGeographyPipeline.test.js` green.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js
npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `landmass-module`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Each landmass pipeline stage has a module object colocated with or adjacent to its implementation.
- [ ] Stage modules export `id`, `label`, `inputs`, `outputKeys`, and `run` (or documented equivalent).
- [ ] `runPipelineStep` dispatches through stage modules instead of a large switch with ad-hoc pickers.
- [ ] No behavior change for default generation and validation exhausted path.
- [ ] `runLandmassPipeline.test.js` and `derivedGeographyPipeline.test.js` pass.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `landmass-module` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #359. MINI-REVIEW-RUBRICS.md § `landmass-module`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-359.md](../plans/ISSUE-359.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
