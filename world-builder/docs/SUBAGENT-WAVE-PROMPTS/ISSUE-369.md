# Subagent prompt — Issue #369

> Copy-paste this entire file to launch an **implementer** subagent for [#369](https://github.com/enmaku/portfolio-site/issues/369).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#369](https://github.com/enmaku/portfolio-site/issues/369) blockers are not closed:

- [#362](https://github.com/enmaku/portfolio-site/issues/362) must be Parent QA PASS
- [#363](https://github.com/enmaku/portfolio-site/issues/363) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-369.md](../plans/ISSUE-369.md) specify.

---

## Issue

- **Title:** Viewport behavioral tests guaranteed under npm test CI
- **Link:** [#369](https://github.com/enmaku/portfolio-site/issues/369)
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
7. world-builder/docs/plans/ISSUE-369.md

---

## Scope boundary

### Files you MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.*.test.js
- package.json
- AGENTS.md

### Files you MUST NOT touch

- world-builder/core/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-369.md](../plans/ISSUE-369.md):

1. 369.1 — Run `npm test 2>&1 | rg -c SKIP` for viewport suites.
2. 369.2 — If skip: fix harness or document Node version in AGENTS.md.
3. 369.3 — Confirm `--experimental-test-module-mocks` in npm test script.
4. 369.4 — CI parity: full `npm test` twice — 0 skipped both runs.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm test
npm run test:world-builder
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `npm test` reports **0 skipped** viewport overlay sync/locality/framing tests (907+ total world-builder tests, 0 skipped in full `npm test`).
- [ ] If Node version constraint is required, record in README or AGENTS.md (not a new markdown file unless repo already has pattern).
- [ ] Overlay sync locality tests from Phase 4 execute in CI, not silently skipped.
- [ ] No vitest introduced; keep Node native test runner.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #369. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-369.md](../plans/ISSUE-369.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
