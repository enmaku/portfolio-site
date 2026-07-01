# Subagent prompt — Issue #378

> Copy-paste this entire file to launch an **implementer** subagent for [#378](https://github.com/enmaku/portfolio-site/issues/378).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#378](https://github.com/enmaku/portfolio-site/issues/378) blockers are not closed:

- [#376](https://github.com/enmaku/portfolio-site/issues/376) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-378.md](../plans/ISSUE-378.md) specify.

---

## Issue

- **Title:** Full repo test gate (npm test)
- **Link:** [#378](https://github.com/enmaku/portfolio-site/issues/378)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/SEAM-TEST-CATALOG.md
7. world-builder/docs/plans/ISSUE-378.md

---

## Scope boundary

### Files you MAY touch

- Test fixes only if failures found

### Files you MUST NOT touch

- Production refactors during gate

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-378.md](../plans/ISSUE-378.md):

1. 378.1 — Run full `npm test`.
2. 378.2 — Run `npm run test:world-builder` twice.
3. 378.3 — Confirm 0 skipped viewport behavioral suites.
4. 378.4 — Fix any failures; no flaky tests introduced.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm test
npm run test:world-builder
npm test
npm run test:world-builder
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `npm test` exits 0.
- [ ] `npm run test:world-builder` exits 0.
- [ ] Skipped test count is 0 for viewport behavioral suites under full `npm test`.
- [ ] No flaky tests introduced (run world-builder suite twice locally if needed).

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

> Apply thermo-nuclear + architecture rubrics to files changed in #378. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-378.md](../plans/ISSUE-378.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
