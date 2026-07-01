# Subagent prompt — Issue #385

> Copy-paste this entire file to launch an **implementer** subagent for [#385](https://github.com/enmaku/portfolio-site/issues/385).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#385](https://github.com/enmaku/portfolio-site/issues/385) blockers are not closed:

- [#362](https://github.com/enmaku/portfolio-site/issues/362) must be Parent QA PASS
- [#363](https://github.com/enmaku/portfolio-site/issues/363) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-385.md](../plans/ISSUE-385.md) specify.

---

## Issue

- **Title:** Pinia overlay display settings persistence regression
- **Link:** [#385](https://github.com/enmaku/portfolio-site/issues/385)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
6. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
7. world-builder/docs/plans/ISSUE-385.md

---

## Scope boundary

### Files you MAY touch

- world-builder/resourceOverlayState.test.js
- world-builder/resourceOverlayStateSeamContract.test.js
- src/composables/useWorldBuilderOverlayState.js

### Files you MUST NOT touch

- world-builder/core/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-385.md](../plans/ISSUE-385.md):

1. 385.1 — Run overlay state + seam contract tests.
2. 385.2 — Verify `resetDefaults` restores persisted defaults and syncs viewport once.
3. 385.3 — Verify `setResourceOverlayDisplaySetting` persists with locality.
4. 385.4 — Document manual reload spot-check for #381.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/resourceOverlayState.test.js
npm run test:world-builder -- world-builder/resourceOverlayStateSeamContract.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `useWorldBuilderOverlayState.test.js` and seam contract tests pass.
- [ ] `resetDefaults` restores persisted defaults and syncs viewport once.
- [ ] `setResourceOverlayDisplaySetting` persists to settings store and commits with locality.
- [ ] Manual spot-check: reload page retains arable threshold.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #385. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-385.md](../plans/ISSUE-385.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
