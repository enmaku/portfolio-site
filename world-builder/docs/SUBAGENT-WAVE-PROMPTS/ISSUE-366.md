# Subagent prompt — Issue #366

> Copy-paste this entire file to launch an **implementer** subagent for [#366](https://github.com/enmaku/portfolio-site/issues/366).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#366](https://github.com/enmaku/portfolio-site/issues/366) blockers are not closed:

- [#364](https://github.com/enmaku/portfolio-site/issues/364) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-366.md](../plans/ISSUE-366.md) specify.

---

## Issue

- **Title:** Worker and clone round-trip for simulationRiverMask
- **Link:** [#366](https://github.com/enmaku/portfolio-site/issues/366)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `worker-clone` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/docs/ARCHITECTURE-SEAMS.md
7. world-builder/docs/plans/ISSUE-366.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/cloneWorldDocument.js
- world-builder/worker/derivedGeographyWorkerProtocol.js
- world-builder/worker/derivedGeographyWorkerProtocol.test.js
- world-builder/runDerivedGeographyInWorker.test.js

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-366.md](../plans/ISSUE-366.md):

1. 366.1 — Audit worker step payloads for `simulationRiverMask`.
2. 366.2 — `cloneWorldDocument` deep copy — no shared buffers with presentation masks.
3. 366.3 — Test preview doc with meander on — simulation field retained.
4. 366.4 — `runDerivedGeographyInWorker.test.js` updated.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/worker/derivedGeographyWorkerProtocol.test.js
npm run test:world-builder -- world-builder/runDerivedGeographyInWorker.test.js
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `worker-clone`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Worker protocol tests assert `simulationRiverMask` in validation/final payloads.
- [ ] `cloneWorldDocument` (or successor) deep-copies simulation mask independently from presentation masks.
- [ ] Preview documents applied to map during generation retain simulation field when presentation fields differ (meander on).
- [ ] Existing clone/worker tests pass; add coverage if gaps found.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `worker-clone` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #366. MINI-REVIEW-RUBRICS.md § `worker-clone`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-366.md](../plans/ISSUE-366.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
