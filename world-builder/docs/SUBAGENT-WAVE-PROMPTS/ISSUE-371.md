# Subagent prompt — Issue #371

> Copy-paste this entire file to launch an **implementer** subagent for [#371](https://github.com/enmaku/portfolio-site/issues/371).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#371](https://github.com/enmaku/portfolio-site/issues/371) blockers are not closed:

- [#357](https://github.com/enmaku/portfolio-site/issues/357) must be Parent QA PASS
- [#358](https://github.com/enmaku/portfolio-site/issues/358) must be Parent QA PASS
- [#360](https://github.com/enmaku/portfolio-site/issues/360) must be Parent QA PASS
- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-371.md](../plans/ISSUE-371.md) specify.

---

## Issue

- **Title:** Collapse redundant hydrology and landmass contract test duplication
- **Link:** [#371](https://github.com/enmaku/portfolio-site/issues/371)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SEAM-TEST-CATALOG.md
6. world-builder/docs/plans/ISSUE-371.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/hydrology/hydrologySubstepContracts.test.js
- world-builder/core/landmassPipelineStageContracts.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-371.md](../plans/ISSUE-371.md):

1. 371.1 — List tests that only assert key list parity.
2. 371.2 — Delete redundant; keep one derive test per pipeline.
3. 371.3 — Test count may decrease; behavior coverage same or better.
4. 371.4 — Run full hydrology + landmass contract integration tests.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubstepContracts.test.js
npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js
npm run test:world-builder
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] No test file exists solely to assert contract key lists mirror module metadata (one derivation test per pipeline is enough).
- [ ] `hydrologySubstepContracts.test.js` and `landmassPipelineStageContracts.test.js` focus on integration invariants, not parallel tables.
- [ ] Test count may decrease; behavior coverage must not.
- [ ] `npm run test:world-builder` passes.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #371. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-371.md](../plans/ISSUE-371.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
