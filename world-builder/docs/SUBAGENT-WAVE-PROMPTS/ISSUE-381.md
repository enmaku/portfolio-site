# Subagent prompt — Issue #381

> Copy-paste this entire file to launch an **implementer** subagent for [#381](https://github.com/enmaku/portfolio-site/issues/381).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#381](https://github.com/enmaku/portfolio-site/issues/381) blockers are not closed:

- [#379](https://github.com/enmaku/portfolio-site/issues/379) must be Parent QA PASS
- [#380](https://github.com/enmaku/portfolio-site/issues/380) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-381.md](../plans/ISSUE-381.md) specify.

---

## Issue

- **Title:** Manual QA checklist for World Builder Phase 5
- **Link:** [#381](https://github.com/enmaku/portfolio-site/issues/381)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `regression-guard` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/MERGE-GATES.md
6. world-builder/docs/plans/ISSUE-381.md

---

## Scope boundary

### Files you MAY touch

- *(none — audit / gate / docs-only)*

### Files you MUST NOT touch

- Production code — manual QA only

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-381.md](../plans/ISSUE-381.md):

1. 381.1 — Generate default world; map renders; pan/zoom; framing on regen.
2. 381.2 — Cancel mid-generation; UI recovers; no stuck progress.
3. 381.3 — Toggle each strategic resource overlay; no indeterminate checkbox.
4. 381.4 — Change arable envelope threshold; only arable overlay affected.
5. 381.5 — Change arable threshold; reload page; verify arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).
6. 381.6 — Change geography seed; regen; validation panel updates.
7. 381.7 — Reset defaults; overlay display settings restore.
8. 381.8 — Validation row map focus zooms expected region.
9. 381.9 — Exhausted validation run shows failure indicator without breaking map.
10. 381.10 — Record results in merge PR test plan.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npx quasar dev — manual at http://localhost:9000/#/projects/world-builder
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `regression-guard`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Generate default world; map renders; pan/zoom works; framing preserved on regen.
- [ ] Cancel mid-generation; UI returns to cancellable state; no stuck progress bar.
- [ ] Toggle each strategic resource overlay on/off; no indeterminate checkbox; no visible stutter on 256²+ grid if available.
- [ ] Change arable envelope threshold; only arable overlay affected visually.
- [ ] Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)).
- [ ] Change geography seed; regen; validation panel updates.
- [ ] Reset defaults; overlay display settings restore.
- [ ] Validation row map focus zooms/focuses expected region.
- [ ] Exhausted validation run shows failure indicator without breaking map.
- [ ] Results checked off in PR test plan.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #381. MINI-REVIEW-RUBRICS.md § `regression-guard`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-381.md](../plans/ISSUE-381.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
