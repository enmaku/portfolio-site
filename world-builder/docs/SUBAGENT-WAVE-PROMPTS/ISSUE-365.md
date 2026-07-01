# Subagent prompt — Issue #365

> Copy-paste this entire file to launch an **implementer** subagent for [#365](https://github.com/enmaku/portfolio-site/issues/365).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#365](https://github.com/enmaku/portfolio-site/issues/365) blockers are not closed:

- [#364](https://github.com/enmaku/portfolio-site/issues/364) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-365.md](../plans/ISSUE-365.md) specify.

---

## Issue

- **Title:** Validation and generation report consume simulation river interface
- **Link:** [#365](https://github.com/enmaku/portfolio-site/issues/365)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `simulation-consumer` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-365.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/validation/runGeographyValidationChecks.js
- world-builder/core/validation/runGeographyValidationChecks.test.js
- world-builder/core/buildGenerationReport.js
- world-builder/core/buildGenerationReport.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-365.md](../plans/ISSUE-365.md):

1. 365.1 — Trace validation river/navigability inputs; document in issue comment.
2. 365.2 — Switch to `simulationRiverMask` for `assembleRiverNetwork` where logistics metrics.
3. 365.3 — Generation report hydrology section uses simulation graph.
4. 365.4 — Test: meander on → validation metrics unchanged.
5. 365.5 — `runGeographyValidationChecks.test.js` green.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/validation/runGeographyValidationChecks.test.js
npm run test:world-builder -- world-builder/core/buildGenerationReport.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `simulation-consumer`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Validation slice assembly passes simulation centerline into `assembleRiverNetwork` (or equivalent) when computing navigability metrics.
- [ ] Generation report hydrology metrics (mouth count, navigable km, Hacks law, etc.) derive from simulation graph/mask.
- [ ] Presentation-only option toggles do not change validation outcomes for checks that are physics-facing.
- [ ] Tests prove validation metrics invariant when only presentation meander/attraction is enabled.
- [ ] `runGeographyValidationChecks.test.js` and pipeline validation tests pass.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `simulation-consumer` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #365. MINI-REVIEW-RUBRICS.md § `simulation-consumer`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-365.md](../plans/ISSUE-365.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
