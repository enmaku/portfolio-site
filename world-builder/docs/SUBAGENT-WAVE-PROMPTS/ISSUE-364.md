# Subagent prompt — Issue #364

> Copy-paste this entire file to launch an **implementer** subagent for [#364](https://github.com/enmaku/portfolio-site/issues/364).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#364](https://github.com/enmaku/portfolio-site/issues/364) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-364.md](../plans/ISSUE-364.md) specify.

---

## Issue

- **Title:** Fix simulation hydrology seam contract test assertions
- **Link:** [#364](https://github.com/enmaku/portfolio-site/issues/364)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `simulation-seam-test` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-364.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/hydrology/**/*Seam*.test.js
- world-builder/**/*SeamContract*.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-364.md](../plans/ISSUE-364.md):

1. 364.1 — Fix `hydrologyRiverPathfindingSeamContract.test.js` default generation test.
2. 364.2 — Assert `simulationRiverMask` length and cell count > 0.
3. 364.3 — Rename tests whose titles say simulation but check presentation only.
4. 364.4 — Audit all `*SeamContract*.test.js`; update SEAM-TEST-CATALOG matrix.
5. 364.5 — Mini thermo: zero mismatched simulation titles.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js
npm run test:world-builder -- world-builder/**/*SeamContract*.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `simulation-seam-test`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `hydrologyRiverPathfindingSeamContract.test.js` default-generation test asserts populated `simulationRiverMask` with correct length and cell count.
- [ ] Test documents relationship: under Option A defaults, simulation and presentation centerlines may match, but logistics consumers must use `simulationRiverMask`.
- [ ] No test title claims simulation while only asserting presentation masks unless the test's purpose is explicitly cross-field comparison.
- [ ] `npm run test:world-builder` passes.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `simulation-seam-test` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #364. MINI-REVIEW-RUBRICS.md § `simulation-seam-test`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-364.md](../plans/ISSUE-364.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
