# Subagent prompt — Issue #370

> Copy-paste this entire file to launch an **implementer** subagent for [#370](https://github.com/enmaku/portfolio-site/issues/370).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#370](https://github.com/enmaku/portfolio-site/issues/370) blockers are not closed:

- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS
- [#363](https://github.com/enmaku/portfolio-site/issues/363) must be Parent QA PASS
- [#365](https://github.com/enmaku/portfolio-site/issues/365) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-370.md](../plans/ISSUE-370.md) specify.

---

## Issue

- **Title:** ADR-0009 renderer and generation seam behavioral audit
- **Link:** [#370](https://github.com/enmaku/portfolio-site/issues/370)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `audit-adr` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-370.md

---

## Scope boundary

### Files you MAY touch

- world-builder/**/*SeamContract*.test.js
- world-builder/renderer/rendererSeamContract.test.js
- world-builder/worldBuilderGenerationSeamContract.test.js
- world-builder/resourceOverlayStateSeamContract.test.js

### Files you MUST NOT touch

- world-builder/core/hydrology/substeps/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-370.md](../plans/ISSUE-370.md):

1. 370.1 — rg generation path for renderer imports — must be 0.
2. 370.2 — Complete `rendererSeamContract.test.js` behavioral coverage.
3. 370.3 — Complete `worldBuilderGenerationSeamContract.test.js`.
4. 370.4 — Complete `resourceOverlayStateSeamContract.test.js`.
5. 370.5 — Findings list → PR test plan section (not new ad-hoc docs).

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/renderer/rendererSeamContract.test.js
npm run test:world-builder -- world-builder/worldBuilderGenerationSeamContract.test.js
npm run test:world-builder -- world-builder/resourceOverlayStateSeamContract.test.js
wc -l <changed-production-files>
rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test
```

Self-check against **MINI-REVIEW-RUBRICS.md § `audit-adr`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `useWorldBuilderGeneration`, orchestrator, and worker modules have no imports from renderer package.
- [ ] `rendererSeamContract.test.js` covers displayBiomes terrain, presentation river overlay, and biome/presentation separation behaviorally.
- [ ] `worldBuilderGenerationSeamContract.test.js` proves generation completes without viewport.
- [ ] `resourceOverlayStateSeamContract.test.js` proves owner-only viewport mutation path.
- [ ] No `readFileSync` source greps in world-builder runtime seam tests (research asset tests exempt).
- [ ] Audit findings documented in PR test plan (not new repo docs unless glossary update needed).

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `audit-adr` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #370. MINI-REVIEW-RUBRICS.md § `audit-adr`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-370.md](../plans/ISSUE-370.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
