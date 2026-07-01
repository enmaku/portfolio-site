# Subagent prompt — Issue #376

> Copy-paste this entire file to launch an **implementer** subagent for [#376](https://github.com/enmaku/portfolio-site/issues/376).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#376](https://github.com/enmaku/portfolio-site/issues/376) blockers are not closed:

- [#355](https://github.com/enmaku/portfolio-site/issues/355) must be Parent QA PASS
- [#356](https://github.com/enmaku/portfolio-site/issues/356) must be Parent QA PASS
- [#357](https://github.com/enmaku/portfolio-site/issues/357) must be Parent QA PASS
- [#358](https://github.com/enmaku/portfolio-site/issues/358) must be Parent QA PASS
- [#359](https://github.com/enmaku/portfolio-site/issues/359) must be Parent QA PASS
- [#360](https://github.com/enmaku/portfolio-site/issues/360) must be Parent QA PASS
- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS
- [#362](https://github.com/enmaku/portfolio-site/issues/362) must be Parent QA PASS
- [#363](https://github.com/enmaku/portfolio-site/issues/363) must be Parent QA PASS
- [#364](https://github.com/enmaku/portfolio-site/issues/364) must be Parent QA PASS
- [#365](https://github.com/enmaku/portfolio-site/issues/365) must be Parent QA PASS
- [#366](https://github.com/enmaku/portfolio-site/issues/366) must be Parent QA PASS
- [#367](https://github.com/enmaku/portfolio-site/issues/367) must be Parent QA PASS
- [#368](https://github.com/enmaku/portfolio-site/issues/368) must be Parent QA PASS
- [#369](https://github.com/enmaku/portfolio-site/issues/369) must be Parent QA PASS
- [#370](https://github.com/enmaku/portfolio-site/issues/370) must be Parent QA PASS
- [#371](https://github.com/enmaku/portfolio-site/issues/371) must be Parent QA PASS
- [#372](https://github.com/enmaku/portfolio-site/issues/372) must be Parent QA PASS
- [#373](https://github.com/enmaku/portfolio-site/issues/373) must be Parent QA PASS
- [#374](https://github.com/enmaku/portfolio-site/issues/374) must be Parent QA PASS
- [#375](https://github.com/enmaku/portfolio-site/issues/375) must be Parent QA PASS
- [#383](https://github.com/enmaku/portfolio-site/issues/383) must be Parent QA PASS
- [#384](https://github.com/enmaku/portfolio-site/issues/384) must be Parent QA PASS
- [#385](https://github.com/enmaku/portfolio-site/issues/385) must be Parent QA PASS
- [#386](https://github.com/enmaku/portfolio-site/issues/386) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-376.md](../plans/ISSUE-376.md) specify.

---

## Issue

- **Title:** Phase 5 branch commit hygiene on world-builder
- **Link:** [#376](https://github.com/enmaku/portfolio-site/issues/376)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/COMMIT-SLICE-MAP.md
6. world-builder/docs/MERGE-GATES.md
7. world-builder/docs/plans/ISSUE-376.md

---

## Scope boundary

### Files you MAY touch

- *(none — audit / gate / docs-only)*

### Files you MUST NOT touch

- No code changes — git hygiene only (maintainer commits)

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-376.md](../plans/ISSUE-376.md):

1. 376.1 — Group commits per COMMIT-SLICE-MAP (hydrology, landmass, overlay, tests, glossary).
2. 376.2 — Maintainer performs commits (agent hooks block autonomous commit).
3. 376.3 — Push branch to origin.
4. 376.4 — Verify `git status` clean; no orphaned deleted test files.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
git status
git log --oneline -20
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `git status` clean after Phase 5 implementation.
- [ ] Commits grouped by slice (not one giant commit, not 50 one-line commits).
- [ ] Commit messages reference issue numbers where helpful.
- [ ] Branch pushed to origin before PR.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #376. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-376.md](../plans/ISSUE-376.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
