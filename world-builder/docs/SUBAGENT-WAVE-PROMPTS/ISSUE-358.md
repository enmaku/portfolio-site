# Subagent prompt — Issue #358

> Copy-paste this entire file to launch an **implementer** subagent for [#358](https://github.com/enmaku/portfolio-site/issues/358).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#358](https://github.com/enmaku/portfolio-site/issues/358) blockers are not closed:

- [#355](https://github.com/enmaku/portfolio-site/issues/355) must be Parent QA PASS
- [#356](https://github.com/enmaku/portfolio-site/issues/356) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-358.md](../plans/ISSUE-358.md) specify.

---

## Issue

- **Title:** RiverMaskPipeline lifecycle invariants after hydrology refactor
- **Link:** [#358](https://github.com/enmaku/portfolio-site/issues/358)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/RIVER-MASK-LIFECYCLE.md
6. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
7. world-builder/docs/plans/ISSUE-358.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/hydrology/**/*.test.js
- world-builder/core/hydrology/riverMaskLifecycle.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-358.md](../plans/ISSUE-358.md):

1. 358.1 — Snapshot tests: stage order sketch→incised→settled→presentation→painted.
2. 358.2 — `skipRefine` transition test unchanged.
3. 358.3 — `enableMeanderRefine: true` → presentation masks change; `simulationRiverMask` byte-equal.
4. 358.4 — `riverAttractionRadiusScale` opt-in → same byte-invariance on simulation mask.
5. 358.5 — Assert `simulationRiverMask` source = settled stage via public API only.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/hydrology/riverMaskLifecycle.test.js
npm run test:world-builder -- world-builder/core/hydrology/
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Mask lifecycle snapshots in hydrology tests still match stage order with defaults off (skipRefine transition).
- [ ] `simulationRiverMask` on pipeline/world document still comes from settled simulation centerline, not presentation refine.
- [ ] Opt-in `enableMeanderRefine` changes presentation masks only; `simulationRiverMask` byte-identical vs default.
- [ ] Opt-in `riverAttractionRadiusScale` changes presentation only; `simulationRiverMask` byte-identical vs default.
- [ ] `riverMaskLifecycle.test.js` and hydrology seam contract tests pass.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #358. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-358.md](../plans/ISSUE-358.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
