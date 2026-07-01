# Subagent prompt — Issue #379

> Copy-paste this entire file to launch an **implementer** subagent for [#379](https://github.com/enmaku/portfolio-site/issues/379).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#379](https://github.com/enmaku/portfolio-site/issues/379) blockers are not closed:

- [#377](https://github.com/enmaku/portfolio-site/issues/377) must be Parent QA PASS
- [#378](https://github.com/enmaku/portfolio-site/issues/378) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-379.md](../plans/ISSUE-379.md) specify.

---

## Issue

- **Title:** Thermo-nuclear dry-run PR self-review (zero structural blockers)
- **Link:** [#379](https://github.com/enmaku/portfolio-site/issues/379)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `audit-adr` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/plans/ISSUE-379.md

---

## Scope boundary

### Files you MAY touch

- *(none — audit / gate / docs-only)*

### Files you MUST NOT touch

- Code changes unless dry-run findings require fixes

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-379.md](../plans/ISSUE-379.md):

1. 379.1 — Run thermo-nuclear dry-run on full branch diff vs main.
2. 379.2 — Document zero structural blockers.
3. 379.3 — Fix or defer any findings (none expected).
4. 379.4 — Capture verdict in merge PR description.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run lint
npm test
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `audit-adr`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Dry-run verdict is APPROVE-equivalent on structure (or COMMENT on own PR with no blockers listed).
- [ ] No open findings in categories: god-bag/shallow modules, overlay locality regression, source-grep tests, file >1k lines, dual contract ceremony, page orchestration leak.
- [ ] Findings list captured in merge PR description as "addressed" or genuinely deferred with ADR/issue (none expected).

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

> Apply thermo-nuclear + architecture rubrics to files changed in #379. MINI-REVIEW-RUBRICS.md § `audit-adr`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-379.md](../plans/ISSUE-379.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
