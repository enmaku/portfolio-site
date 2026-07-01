# Subagent prompt — Issue #373

> Copy-paste this entire file to launch an **implementer** subagent for [#373](https://github.com/enmaku/portfolio-site/issues/373).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#373](https://github.com/enmaku/portfolio-site/issues/373) blockers are not closed:

- [#365](https://github.com/enmaku/portfolio-site/issues/365) must be Parent QA PASS
- [#366](https://github.com/enmaku/portfolio-site/issues/366) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-373.md](../plans/ISSUE-373.md) specify.

---

## Issue

- **Title:** CONTEXT.md simulation vs presentation hydrology vocabulary
- **Link:** [#373](https://github.com/enmaku/portfolio-site/issues/373)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `docs-only` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/SIMULATION-VS-PRESENTATION-HYDROLOGY.md
6. world-builder/CONTEXT.md
7. world-builder/docs/plans/ISSUE-373.md

---

## Scope boundary

### Files you MAY touch

- world-builder/CONTEXT.md

### Files you MUST NOT touch

- world-builder/core/**
- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-373.md](../plans/ISSUE-373.md):

1. 373.1 — Add `Simulation hydrology` and `Presentation hydrology` to Language section.
2. 373.2 — Document `_Avoid` aliases.
3. 373.3 — Cross-check terms match SIMULATION-VS-PRESENTATION-HYDROLOGY.md.
4. 373.4 — No implementation detail in CONTEXT.md.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `docs-only`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] CONTEXT.md defines simulation hydrology outputs (logistics-facing) and presentation hydrology outputs (map display).
- [ ] `_Avoid` aliases documented (e.g. using "river network mask" alone when meaning simulation).
- [ ] Terms match issue/PRD vocabulary used in #354 tree.
- [ ] No code changes required beyond glossary unless naming mismatch found.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `docs-only` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #373. MINI-REVIEW-RUBRICS.md § `docs-only`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-373.md](../plans/ISSUE-373.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
