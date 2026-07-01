# Subagent prompt — Issue #380

> Copy-paste this entire file to launch an **implementer** subagent for [#380](https://github.com/enmaku/portfolio-site/issues/380).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#380](https://github.com/enmaku/portfolio-site/issues/380) blockers are not closed:

- [#377](https://github.com/enmaku/portfolio-site/issues/377) must be Parent QA PASS
- [#378](https://github.com/enmaku/portfolio-site/issues/378) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-380.md](../plans/ISSUE-380.md) specify.

---

## Issue

- **Title:** Architecture dry-run PR self-review (PR-scoped)
- **Link:** [#380](https://github.com/enmaku/portfolio-site/issues/380)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `audit-adr` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/ARCHITECTURE-SEAMS.md
6. world-builder/docs/plans/ISSUE-380.md

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

Execute **every** sub-sub-step in [plans/ISSUE-380.md](../plans/ISSUE-380.md):

1. 380.1 — Run PR-scoped architecture dry-run (max 3 deepening items).
2. 380.2 — Verify three Strong deepenings: hydrology modules, vector locality, derived contracts.
3. 380.3 — Document deletion-test narrative in PR body.
4. 380.4 — Resolve or accept any Strong findings with written rationale.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder
wc -l <changed-production-files>
```

Self-check against **MINI-REVIEW-RUBRICS.md § `audit-adr`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Hydrology modules pass deletion test (complexity concentrates in modules, not bags).
- [ ] Landmass contracts derived from modules.
- [ ] Overlay owner → viewport seam has raster **and** vector locality.
- [ ] Simulation vs presentation hydrology seam clear for logistics pass.
- [ ] No merge-blocking architecture findings remain.

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

> Apply thermo-nuclear + architecture rubrics to files changed in #380. MINI-REVIEW-RUBRICS.md § `audit-adr`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-380.md](../plans/ISSUE-380.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
