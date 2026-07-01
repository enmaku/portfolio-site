# Subagent prompt — Issue #360

> Copy-paste this entire file to launch an **implementer** subagent for [#360](https://github.com/enmaku/portfolio-site/issues/360).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#360](https://github.com/enmaku/portfolio-site/issues/360) blockers are not closed:

- [#359](https://github.com/enmaku/portfolio-site/issues/359) must be Parent QA PASS

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-360.md](../plans/ISSUE-360.md) specify.

---

## Issue

- **Title:** Derive landmass stage contracts from stage modules
- **Link:** [#360](https://github.com/enmaku/portfolio-site/issues/360)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `landmass-contract-derive` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/LANDMASS-STAGE-MODULES.md
6. world-builder/docs/HYDROLOGY-TYPED-STAGES.md
7. world-builder/docs/plans/ISSUE-360.md

---

## Scope boundary

### Files you MAY touch

- world-builder/core/landmassPipelineStageContracts.js
- world-builder/core/landmassPipelineStageContracts.test.js
- world-builder/core/stages/**

### Files you MUST NOT touch

- world-builder/renderer/**

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-360.md](../plans/ISSUE-360.md):

1. 360.1 — Implement `deriveLandmassStageContract(module)` mirroring hydrology pattern.
2. 360.2 — Replace manual `LANDMASS_PIPELINE_STAGE_CONTRACTS` object.
3. 360.3 — Replace `pickLandmassStageInput` switch with `selectLandmassStageInput(module, state)`.
4. 360.4 — Delete redundant JSDoc typedefs duplicating module inputs.
5. 360.5 — Update `landmassPipelineStageContracts.test.js` — test derivation, not parallel tables.
6. 360.6 — grep: no hand-maintained `inputKeys:` arrays outside derive function.
7. 360.7 — Mini arch: deletion test on old pickers.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/core/landmassPipelineStageContracts.test.js
wc -l <changed-production-files>
rg 'inputKeys:' world-builder/core/ --glob '*.js' | rg -v derive
```

Self-check against **MINI-REVIEW-RUBRICS.md § `landmass-contract-derive`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] `LANDMASS_PIPELINE_STAGE_CONTRACTS` is computed from stage modules, not duplicated by hand.
- [ ] `pickLandmassStageInput` (or successor) uses module input selectors.
- [ ] `assertLandmassStageOutputs` validates against module `outputKeys`.
- [ ] `landmassPipelineStageContracts.test.js` updated to test derivation, not parallel tables.
- [ ] No duplicate contract definition surfaces remain for landmass stages.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `landmass-contract-derive` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #360. MINI-REVIEW-RUBRICS.md § `landmass-contract-derive`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-360.md](../plans/ISSUE-360.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
