# Subagent prompt — Issue #368

> Copy-paste this entire file to launch an **implementer** subagent for [#368](https://github.com/enmaku/portfolio-site/issues/368).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#368](https://github.com/enmaku/portfolio-site/issues/368) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-368.md](../plans/ISSUE-368.md) specify.

---

## Issue

- **Title:** World Builder page display model extraction from SFC
- **Link:** [#368](https://github.com/enmaku/portfolio-site/issues/368)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `page-sfc` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/PAGE-CONTROLLER-INTERFACE.md
6. world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
7. world-builder/docs/plans/ISSUE-368.md

---

## Scope boundary

### Files you MAY touch

- src/pages/projects/WorldBuilderPage.vue
- world-builder/worldBuilderPageModel.js
- world-builder/worldBuilderPageModel.test.js
- src/composables/useWorldBuilderPageController.js

### Files you MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/renderer/createWorldBuilderMapViewport.js

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-368.md](../plans/ISSUE-368.md):

1. 368.1 — Inventory SFC script imports from core/renderer/worker.
2. 368.2 — Move format helpers to `worldBuilderPageModel.js`.
3. 368.3 — Move validation display wiring to model or controller.
4. 368.4 — SFC imports only: vue, quasar, controller composable, page model exports.
5. 368.5 — grep gate: no `@world-builder/core` in SFC.
6. 368.6 — Mini arch: page seam matches ADR-0009.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/worldBuilderPageModel.test.js
npm run test:world-builder -- src/composables/useWorldBuilderPageController.test.js
wc -l <changed-production-files>
rg '@world-builder/core' src/pages/projects/WorldBuilderPage.vue
```

Self-check against **MINI-REVIEW-RUBRICS.md § `page-sfc`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] SFC `<script setup>` contains no map lifecycle handles, worker imports, or generation orchestration.
- [ ] All `format*` display helpers consumed via page model or controller exports.
- [ ] Page line count reduced or unchanged with strictly less imports from core/renderer packages.
- [ ] `useWorldBuilderPageController.test.js` still passes; add tests if new controller exports appear.
- [ ] eslint clean on page + controller + model.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `page-sfc` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #368. MINI-REVIEW-RUBRICS.md § `page-sfc`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-368.md](../plans/ISSUE-368.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
