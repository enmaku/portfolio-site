# Subagent prompt — Issue #382

> Copy-paste this entire file to launch an **implementer** subagent for [#382](https://github.com/enmaku/portfolio-site/issues/382).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#382](https://github.com/enmaku/portfolio-site/issues/382) blockers are not closed:

- [#381](https://github.com/enmaku/portfolio-site/issues/381) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-382.md](../plans/ISSUE-382.md) specify.

---

## Issue

- **Title:** Open merge PR: world-builder → main
- **Link:** [#382](https://github.com/enmaku/portfolio-site/issues/382)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/plans/ISSUE-382.md

---

## Scope boundary

### Files you MAY touch

- *(none — audit / gate / docs-only)*

### Files you MUST NOT touch

- No code — PR creation only

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-382.md](../plans/ISSUE-382.md):

1. 382.1 — Open ready-for-review PR `world-builder` → `main`.
2. 382.2 — PR body: Phase 1–5 summary, ADR-0009 compliance, issue closure list.
3. 382.3 — PR test plan includes manual QA from #381.
4. 382.4 — Confirm CI green; assignee enmaku.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run lint
npm test
npm run build
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] PR created ready for review (not draft).
- [ ] PR body summarizes Phase 1–5 outcomes and ADR-0009 compliance.
- [ ] PR test plan includes manual QA checklist from #381.
- [ ] CI green on PR (`npm run lint`, `npm test`, build if CI runs build).
- [ ] Assignee: enmaku.
- [ ] Links closing keywords for #354 when merged (do not auto-close #293 unless intended).

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

> Apply thermo-nuclear + architecture rubrics to files changed in #382. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-382.md](../plans/ISSUE-382.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
