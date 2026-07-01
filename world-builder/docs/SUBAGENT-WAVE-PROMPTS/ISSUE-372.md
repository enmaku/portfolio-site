# Subagent prompt — Issue #372

> Copy-paste this entire file to launch an **implementer** subagent for [#372](https://github.com/enmaku/portfolio-site/issues/372).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#372](https://github.com/enmaku/portfolio-site/issues/372) blockers are not closed:

- [#356](https://github.com/enmaku/portfolio-site/issues/356) must be Parent QA PASS
- [#361](https://github.com/enmaku/portfolio-site/issues/361) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-372.md](../plans/ISSUE-372.md) specify.

---

## Issue

- **Title:** Production file size audit (no file over 1000 lines)
- **Link:** [#372](https://github.com/enmaku/portfolio-site/issues/372)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/FILE-SIZE-BUDGET.md
6. world-builder/docs/MERGE-GATES.md
7. world-builder/docs/plans/ISSUE-372.md

---

## Scope boundary

### Files you MAY touch

- *(none — audit / gate / docs-only)*

### Files you MUST NOT touch

- All production code — audit only unless split required

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-372.md](../plans/ISSUE-372.md):

1. 372.1 — List all production `.js`/`.vue` on branch — flag >600, >800, >1000 lines.
2. 372.2 — Any >1000: split or justify in PR body.
3. 372.3 — Confirm orchestrator ≤650, hydrology registry ≤80, substep files ≤250.
4. 372.4 — Summarize audit in merge PR body template.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder
wc -l <changed-production-files>
find world-builder -name '*.js' -not -path '*/test*' -not -name '*.test.js' -exec wc -l {} + | sort -n | tail -20
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] No production `.js`/`.vue` file on the branch exceeds 1000 lines without explicit PR justification.
- [ ] `hydrologySubstepModules` monolith eliminated (see #356).
- [ ] `derivedGeographyPipeline` orchestrator under 650 lines (see #361).
- [ ] `worldBuilderGenerationControls` metadata either accepted under limit or split by control section if over threshold.
- [ ] Audit result summarized in merge PR body.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #372. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-372.md](../plans/ISSUE-372.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
