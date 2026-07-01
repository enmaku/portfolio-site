# Subagent prompt — Issue #356

> Copy-paste this entire file to launch an **implementer** subagent for [#356](https://github.com/enmaku/portfolio-site/issues/356).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#356](https://github.com/enmaku/portfolio-site/issues/356) blockers are not closed:

- [#355](https://github.com/enmaku/portfolio-site/issues/355) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-356.md](../plans/ISSUE-356.md) specify.

---

## Issue

- **Title:** Split hydrology substep modules into per-substep files
- **Link:** [#356](https://github.com/enmaku/portfolio-site/issues/356)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `hydrology-file-split` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/HYDROLOGY-SUBSTEP-FILE-MAP.md
6. world-builder/docs/HYDROLOGY-TYPED-STAGES.md
7. world-builder/docs/hydrology/substep-specs/SUBSTEP-hydrologyFill.md
8. world-builder/docs/plans/ISSUE-356.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/hydrology/substeps/**
- world-builder/core/hydrology/hydrologySubstepModules.js
- world-builder/core/hydrology/baselineDrainageFromState.js
- world-builder/core/hydrology/hydrologySubsteps.test.js
- world-builder/core/hydrology/hydrologySubstepModules.test.js

### Files you MUST NOT touch

- world-builder/renderer/**
- world-builder/core/derivedGeographyPipeline.js

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-356.md](../plans/ISSUE-356.md):

1. 356.1 — Extract `substeps/hydrologyFillSubstep.js` (≤250 lines).
2. 356.2 — Extract `substeps/hydrologyClimateSubstep.js` (≤200 lines).
3. 356.3 — Extract `substeps/hydrologySeasonalSubstep.js` (≤200 lines).
4. 356.4 — Extract `substeps/hydrologyRouteSubstep.js` (≤250 lines).
5. 356.5 — Extract `substeps/hydrologyInciseSubstep.js` (≤200 lines).
6. 356.6 — Extract `substeps/hydrologyExtractSubstep.js` (≤200 lines).
7. 356.7 — Extract `substeps/hydrologyRefineSubstep.js` (≤200 lines).
8. 356.8 — Extract `substeps/hydrologySettleSubstep.js` (≤250 lines).
9. 356.9 — Extract `substeps/hydrologyPaintSubstep.js` (≤250 lines).
10. 356.10 — Create `substeps/index.js` registry (≤80 lines, import-only).
11. 356.11 — Extract `baselineDrainageFromState.js` helper (≤60 lines).
12. 356.12 — Delete monolithic `hydrologySubstepModules.js`; shim re-export only if required.
13. 356.13 — Update imports repo-wide; `rg hydrologySubstepModules` hits zero except changelog.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepModules.test.js
npm run test:world-builder
wc -l <changed-production-files>
wc -l world-builder/core/hydrology/substeps/*.js
```

Self-check against **MINI-REVIEW-RUBRICS.md § `hydrology-file-split`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Nine substep implementations live in dedicated files; registry is import-only.
- [ ] All existing hydrology substep behavior tests pass unchanged in outcome (update imports only as needed).
- [ ] `hydrologySubsteps.test.js` and `hydrologySubstepModules.test.js` remain green.
- [ ] eslint clean on all new/changed hydrology files.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `hydrology-file-split` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #356. MINI-REVIEW-RUBRICS.md § `hydrology-file-split`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-356.md](../plans/ISSUE-356.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
