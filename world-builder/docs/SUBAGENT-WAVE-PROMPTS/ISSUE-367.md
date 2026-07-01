# Subagent prompt — Issue #367

> Copy-paste this entire file to launch an **implementer** subagent for [#367](https://github.com/enmaku/portfolio-site/issues/367).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#367](https://github.com/enmaku/portfolio-site/issues/367) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-367.md](../plans/ISSUE-367.md) specify.

---

## Issue

- **Title:** Resource overlay checkbox toggle and indeterminate state
- **Link:** [#367](https://github.com/enmaku/portfolio-site/issues/367)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `checkbox-ux` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
6. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
7. world-builder/docs/plans/ISSUE-367.md

---

## Scope boundary

### Files you MAY touch

- src/pages/projects/WorldBuilderPage.vue
- world-builder/resourceOverlayState.js
- world-builder/resourceOverlayState.test.js
- src/composables/useWorldBuilderOverlayState.js
- world-builder/worldBuilderOverlayControls.js

### Files you MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/core/derivedGeographyPipeline.js

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-367.md](../plans/ISSUE-367.md):

1. 367.1 — Reproduce: document exact Quasar props causing indeterminate state.
2. 367.2 — Normalize booleans in overlay owner before commit.
3. 367.3 — Fix SFC bindings — no tri-state `:model-value`.
4. 367.4 — Seam test: on→off === false (no copy assertions).
5. 367.5 — Manual repro steps in issue comment (for #381).

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/resourceOverlayState.test.js
npm run test:world-builder -- world-builder/worldBuilderOverlayControls.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `checkbox-ux`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Manual repro fixed: check overlay → uncheck overlay returns to unchecked (not indeterminate dash).
- [ ] `:model-value` binding uses boolean from overlay owner without tri-state leakage.
- [ ] If `null`/`undefined` can appear in visibility map, normalize in overlay owner before commit.
- [ ] Behavioral test at overlay composable or page-controller seam if feasible without copy assertions (state contract test).
- [ ] No user-facing copy assertions in tests.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `checkbox-ux` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #367. MINI-REVIEW-RUBRICS.md § `checkbox-ux`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-367.md](../plans/ISSUE-367.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
