# Subagent prompt — Issue #374

> Copy-paste this entire file to launch an **implementer** subagent for [#374](https://github.com/enmaku/portfolio-site/issues/374).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#374](https://github.com/enmaku/portfolio-site/issues/374) blockers are not closed:

- [#357](https://github.com/enmaku/portfolio-site/issues/357) must be Parent QA PASS
- [#358](https://github.com/enmaku/portfolio-site/issues/358) must be Parent QA PASS
- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-374.md](../plans/ISSUE-374.md) specify.

---

## Issue

- **Title:** Default generation end-to-end smoke after Phase 5 refactors
- **Link:** [#374](https://github.com/enmaku/portfolio-site/issues/374)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SEAM-TEST-CATALOG.md
6. world-builder/docs/MERGE-GATES.md
7. world-builder/docs/plans/ISSUE-374.md

---

## Scope boundary

### Files you MAY touch

- world-builder/worldBuilder.integration.test.js
- world-builder/core/generateDerivedGeography.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-374.md](../plans/ISSUE-374.md):

1. 374.1 — One integration test — modest grid (64² or 128²).
2. 374.2 — Assert world document, simulationRiverMask, displayBiomes, validation report.
3. 374.3 — Runtime <60s CI.
4. 374.4 — No hydrology internal mocks.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/worldBuilder.integration.test.js
npm run test:world-builder -- world-builder/core/generateDerivedGeography.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Single smoke test covers full default pipeline without mocking hydrology internals.
- [ ] Asserts `simulationRiverMask` populated post-hydrology.
- [ ] Asserts `displayBiomes` populated.
- [ ] Runs in `npm run test:world-builder` under 60s on CI hardware (use modest grid if needed).
- [ ] Fails if pipeline wiring regresses across module refactor.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #374. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-374.md](../plans/ISSUE-374.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
