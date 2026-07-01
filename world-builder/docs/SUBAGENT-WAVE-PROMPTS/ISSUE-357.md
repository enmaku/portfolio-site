# Subagent prompt — Issue #357

> Copy-paste this entire file to launch an **implementer** subagent for [#357](https://github.com/enmaku/portfolio-site/issues/357).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#357](https://github.com/enmaku/portfolio-site/issues/357) blockers are not closed:

- [#355](https://github.com/enmaku/portfolio-site/issues/355) must be Parent QA PASS
- [#356](https://github.com/enmaku/portfolio-site/issues/356) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-357.md](../plans/ISSUE-357.md) specify.

---

## Issue

- **Title:** Hydrology flow-field recompute invariants after typing refactor
- **Link:** [#357](https://github.com/enmaku/portfolio-site/issues/357)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/FLOW-FIELD-INVARIANTS.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-357.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/derivedGeographyPipeline.test.js
- world-builder/core/hydrology/**/*.test.js

### Files you MUST NOT touch

- world-builder/renderer/**
- src/pages/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-357.md](../plans/ISSUE-357.md):

1. 357.1 — Document in test comments the three full-solve stages: route, extract, settle.
2. 357.2 — Assert `fullFlowSolveCount === 3` for default generation in `derivedGeographyPipeline.test.js`.
3. 357.3 — Assert `solveLog` entries match documented stage/reason labels.
4. 357.4 — Seasonal hydrology enabled: assert no additional full solves vs baseline.
5. 357.5 — Mini thermo: no hidden full solve in substep delegate without log entry.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
npm run test:world-builder -- world-builder/core/hydrology/
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Default derived-geography generation still performs exactly **three** full flow solves (or the currently documented invariant—update tests only if behavior was wrong).
- [ ] `flowFieldSession.solveLog` entries retain stage/reason labels used by generation report.
- [ ] Enabling seasonal hydrology does not accidentally add silent full solves.
- [ ] `derivedGeographyPipeline.test.js` and hydrology substep tests covering flow counts pass.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #357. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-357.md](../plans/ISSUE-357.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
