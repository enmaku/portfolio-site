# Subagent prompt — Issue #363

> Copy-paste this entire file to launch an **implementer** subagent for [#363](https://github.com/enmaku/portfolio-site/issues/363).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#363](https://github.com/enmaku/portfolio-site/issues/363) blockers are not closed:

- [#362](https://github.com/enmaku/portfolio-site/issues/362) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-363.md](../plans/ISSUE-363.md) specify.

---

## Issue

- **Title:** Vector overlay refresh locality behavioral tests
- **Link:** [#363](https://github.com/enmaku/portfolio-site/issues/363)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `overlay-vector-test` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-363.md

---

## Scope boundary

### Files you MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js
- world-builder/renderer/createWorldBuilderMapViewport.*.test.js

### Files you MUST NOT touch

- world-builder/core/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-363.md](../plans/ISSUE-363.md):

1. 363.1 — Test: arable+timber+metals+salt rasters on; toggle salt nodes only → raster RGBA build 0.
2. 363.2 — Test: coastal present; toggle salt only → coastal draw count unchanged.
3. 363.3 — Test: toggle metals nodes only → salt and coastal unchanged.
4. 363.4 — Extend harness: per-layer spy (`drawnCirclesByLayer` or equivalent).
5. 363.5 — No source-grep or import-ban assertions.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `overlay-vector-test`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Test: enable arable+timber+metals+salt rasters, then toggle salt nodes only—resource raster RGBA build count stays 0.
- [ ] Test: coastal nodes present; toggle salt only—coastal draw count unchanged (or coastal layer not refreshed).
- [ ] Test: toggle metals nodes only—salt and coastal unchanged.
- [ ] Tests run under `npm run test:world-builder` (with module mocks), not skipped.
- [ ] No source-grep or import-ban assertions.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `overlay-vector-test` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #363. MINI-REVIEW-RUBRICS.md § `overlay-vector-test`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-363.md](../plans/ISSUE-363.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
