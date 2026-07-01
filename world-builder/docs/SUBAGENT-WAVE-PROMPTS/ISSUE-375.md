# Subagent prompt — Issue #375

> Copy-paste this entire file to launch an **implementer** subagent for [#375](https://github.com/enmaku/portfolio-site/issues/375).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#375](https://github.com/enmaku/portfolio-site/issues/375) blockers are not closed:

- [#368](https://github.com/enmaku/portfolio-site/issues/368) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-375.md](../plans/ISSUE-375.md) specify.

---

## Issue

- **Title:** Page controller behavioral coverage completeness
- **Link:** [#375](https://github.com/enmaku/portfolio-site/issues/375)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `page-controller-test` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-375.md

---

## Scope boundary

### Files you MAY touch

- src/composables/useWorldBuilderPageController.test.js
- src/composables/useWorldBuilderPageController.js

### Files you MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-375.md](../plans/ISSUE-375.md):

1. 375.1 — Test `onToggleChange` regenerates.
2. 375.2 — Test `onSliderInput` does not regenerate until commit.
3. 375.3 — Test `randomizeSeed` updates seed + regen.
4. 375.4 — Test `resetOverlays` visibility reset + sync.
5. 375.5 — Test error forwarding via `onGenerationError`.
6. 375.6 — Test `start()` overlay sync on viewport ready.
7. 375.7 — Matrix: every public controller method with side effects has a test.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `page-controller-test`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Each public controller method with side effects has at least one behavioral test.
- [ ] Tests use injected fakes (no full Vue page mount, no copy assertions).
- [ ] Overlay sync to viewport verified on `start()` viewport ready.
- [ ] All tests pass; eslint clean.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `page-controller-test` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #375. MINI-REVIEW-RUBRICS.md § `page-controller-test`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-375.md](../plans/ISSUE-375.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
