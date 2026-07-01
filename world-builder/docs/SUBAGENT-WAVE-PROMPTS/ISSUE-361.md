# Subagent prompt — Issue #361

> Copy-paste this entire file to launch an **implementer** subagent for [#361](https://github.com/enmaku/portfolio-site/issues/361).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#361](https://github.com/enmaku/portfolio-site/issues/361) blockers are not closed:

- [#359](https://github.com/enmaku/portfolio-site/issues/359) must be Parent QA PASS
- [#360](https://github.com/enmaku/portfolio-site/issues/360) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-361.md](../plans/ISSUE-361.md) specify.

---

## Issue

- **Title:** Decompose derived geography pipeline orchestrator
- **Link:** [#361](https://github.com/enmaku/portfolio-site/issues/361)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `orchestrator-decompose` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/ORCHESTRATOR-DECOMPOSITION.md
6. world-builder/docs/FILE-SIZE-BUDGET.md
7. world-builder/docs/plans/ISSUE-361.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/derivedGeographyPipeline.js
- world-builder/core/cloneWorldDocument.js
- world-builder/core/buildWorldDocumentFromPipelineState.js
- world-builder/core/landmassPipelineRunner.js
- world-builder/worker/**
- world-builder/worldBuilder.integration.test.js
- world-builder/core/derivedGeographyPipeline.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-361.md](../plans/ISSUE-361.md):

1. 361.1 — Extract clone helper to `cloneWorldDocument.js` (≤80 lines).
2. 361.2 — Extract world doc assembly to `buildWorldDocumentFromPipelineState.js` (≤70 lines).
3. 361.3 — Extract retry + hooks + step loop to `landmassPipelineRunner.js` (≤300 lines).
4. 361.4 — Slim `derivedGeographyPipeline.js` to re-exports + thin dispatch (≤650 lines).
5. 361.5 — Update worker + integration imports.
6. 361.6 — wc -l gate on all production files touched.
7. 361.7 — Full test suite green.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/derivedGeographyPipeline.test.js
npm run test:world-builder -- world-builder/worldBuilder.integration.test.js
npm run test:world-builder -- world-builder/worker/
wc -l <changed-production-files>
wc -l world-builder/core/derivedGeographyPipeline.js
```

Self-check against **MINI-REVIEW-RUBRICS.md § `orchestrator-decompose`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `derivedGeographyPipeline.js` (or renamed orchestrator) is under 650 lines.
- [ ] No production file introduced or enlarged past **1000 lines** by this decomposition.
- [ ] `generateDerivedGeography`, worker protocol, and page generation still work end-to-end.
- [ ] `derivedGeographyPipeline.test.js`, `worldBuilder.integration.test.js`, and worker tests pass.
- [ ] eslint clean on extracted modules.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `orchestrator-decompose` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #361. MINI-REVIEW-RUBRICS.md § `orchestrator-decompose`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-361.md](../plans/ISSUE-361.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
