# Subagent prompt — Issue #384

> Copy-paste this entire file to launch an **implementer** subagent for [#384](https://github.com/enmaku/portfolio-site/issues/384).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#384](https://github.com/enmaku/portfolio-site/issues/384) blockers are not closed:

- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS
- [#375](https://github.com/enmaku/portfolio-site/issues/375) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-384.md](../plans/ISSUE-384.md) specify.

---

## Issue

- **Title:** Generation cancel and stale-run regression guard
- **Link:** [#384](https://github.com/enmaku/portfolio-site/issues/384)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SEAM-TEST-CATALOG.md
6. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
7. world-builder/docs/plans/ISSUE-384.md

---

## Scope boundary

### Files you MAY touch

- world-builder/worldBuilderGenerationCancel.test.js
- world-builder/worldBuilderGenerationOrchestrator.test.js
- src/composables/useWorldBuilderPageController.test.js

### Files you MUST NOT touch

- world-builder/core/hydrology/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-384.md](../plans/ISSUE-384.md):

1. 384.1 — Run `worldBuilderGenerationCancel.test.js`.
2. 384.2 — Run orchestrator stale-run and cancel tests.
3. 384.3 — Verify page controller destroy cancels active run.
4. 384.4 — Assert no duplicate world-document apply from stale worker after rapid regenerate.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/worldBuilderGenerationCancel.test.js
npm run test:world-builder -- world-builder/worldBuilderGenerationOrchestrator.test.js
npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `worldBuilderGenerationCancel.test.js` passes.
- [ ] `worldBuilderGenerationOrchestrator.test.js` stale-run and cancel tests pass.
- [ ] Page controller destroy cancels active run (controller test).
- [ ] No duplicate world-document apply from stale worker after rapid regenerate.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #384. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-384.md](../plans/ISSUE-384.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
