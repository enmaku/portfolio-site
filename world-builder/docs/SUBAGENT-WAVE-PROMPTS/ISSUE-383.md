# Subagent prompt — Issue #383

> Copy-paste this entire file to launch an **implementer** subagent for [#383](https://github.com/enmaku/portfolio-site/issues/383).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#383](https://github.com/enmaku/portfolio-site/issues/383) blockers are not closed:

- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS
- [#362](https://github.com/enmaku/portfolio-site/issues/362) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-383.md](../plans/ISSUE-383.md) specify.

---

## Issue

- **Title:** Map document dirty refresh regression guard
- **Link:** [#383](https://github.com/enmaku/portfolio-site/issues/383)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-383.md

---

## Scope boundary

### Files you MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js

### Files you MUST NOT touch

- world-builder/core/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-383.md](../plans/ISSUE-383.md):

1. 383.1 — Run `createWorldBuilderMapViewport.documentUpdate.test.js` (0 skipped).
2. 383.2 — Assert `displayBiomes`-only change refreshes terrain, not rivers/lakes/rasters.
3. 383.3 — Assert presentation mask change refreshes rivers/lakes appropriately.
4. 383.4 — Add build-count spies if gaps exist; no copy assertions.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.documentUpdate.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `createWorldBuilderMapViewport.documentUpdate.test.js` passes with 0 skipped.
- [ ] Changing only `displayBiomes` refreshes terrain, not rivers/lakes/rasters (or documented correct set).
- [ ] Changing river presentation masks refreshes rivers/lakes as appropriate, not full terrain stack unless required.
- [ ] Build-count or visibility spies prove locality where tests already exist.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #383. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-383.md](../plans/ISSUE-383.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
