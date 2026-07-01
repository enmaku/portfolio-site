# Subagent prompt — Issue #386

> Copy-paste this entire file to launch an **implementer** subagent for [#386](https://github.com/enmaku/portfolio-site/issues/386).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#386](https://github.com/enmaku/portfolio-site/issues/386) blockers are not closed:

- [#365](https://github.com/enmaku/portfolio-site/issues/365) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-386.md](../plans/ISSUE-386.md) specify.

---

## Issue

- **Title:** Rejection sampling and validation checks regression guard
- **Link:** [#386](https://github.com/enmaku/portfolio-site/issues/386)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-386.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/validation/runGeographyValidationChecks.test.js
- world-builder/core/landmassValidationContracts.test.js
- world-builder/core/runLandmassPipeline.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-386.md](../plans/ISSUE-386.md):

1. 386.1 — Run validation + landmass contract tests.
2. 386.2 — Verify exhausted retry behavior unchanged on known fixtures.
3. 386.3 — Assert validation rows still expose `mapFocus` for controller focus tests.
4. 386.4 — Confirm simulation mask does not break coast mouth or navigable checks.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/validation/runGeographyValidationChecks.test.js
npm run test:world-builder -- world-builder/core/landmassValidationContracts.test.js
npm run test:world-builder -- world-builder/core/runLandmassPipeline.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `runGeographyValidationChecks.test.js` and `landmassValidationContracts.test.js` pass.
- [ ] `runLandmassPipeline.test.js` exhausted retry behavior unchanged.
- [ ] Validation rows still expose `mapFocus` where expected for page controller focus tests.
- [ ] Simulation mask used does not break coast mouth or navigable path checks on known fixtures.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `regression-guard` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #386. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-386.md](../plans/ISSUE-386.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
