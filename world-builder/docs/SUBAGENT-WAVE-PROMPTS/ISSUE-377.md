# Subagent prompt — Issue #377

> Copy-paste this entire file to launch an **implementer** subagent for [#377](https://github.com/enmaku/portfolio-site/issues/377).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#377](https://github.com/enmaku/portfolio-site/issues/377) blockers are not closed:

- [#376](https://github.com/enmaku/portfolio-site/issues/376) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-377.md](../plans/ISSUE-377.md) specify.

---

## Issue

- **Title:** Full repo eslint gate (npm run lint)
- **Link:** [#377](https://github.com/enmaku/portfolio-site/issues/377)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/plans/ISSUE-377.md

---

## Scope boundary

### Files you MAY touch

- Any Phase 5 touched files with lint fixes only

### Files you MUST NOT touch

- Unrelated repo areas unless pre-existing lint failures documented

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-377.md](../plans/ISSUE-377.md):

1. 377.1 — Run `npm run lint` on full repo.
2. 377.2 — Run `npx eslint --max-warnings 0` on every Phase 5 touched file.
3. 377.3 — Fix all errors/warnings; no new eslint-disable without justification.
4. 377.4 — Document pre-existing failures outside world-builder if any remain.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run lint
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `npm run lint` exits 0 with `--max-warnings 0` equivalent (repo default).
- [ ] Every file created or modified in Phase 5 individually passes `npx eslint --max-warnings 0 <file>`.
- [ ] No `eslint-disable` added unless pre-existing pattern with justification.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #377. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-377.md](../plans/ISSUE-377.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
