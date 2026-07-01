# Subagent prompt — Issue #362

> Copy-paste this entire file to launch an **implementer** subagent for [#362](https://github.com/enmaku/portfolio-site/issues/362).

---

## STOP

**STOP** if you have not read every document listed in **Mandatory reading** below.

**STOP** if Wave 0 `DOC-AUDIT` has not passed ([PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md)).

**STOP** if [#362](https://github.com/enmaku/portfolio-site/issues/362) blockers are not closed:

- No blockers — you may start immediately.

Do **not** close GitHub issues. Do **not** skip AutoVerify or self-review against MINI-REVIEW-RUBRICS.

---

## Role

You are an **implementer subagent** on the `world-builder` branch. You deliver only what this prompt and [plans/ISSUE-362.md](../plans/ISSUE-362.md) specify.

---

## Issue

- **Title:** Vector overlay per-family map layer refresh
- **Link:** [#362](https://github.com/enmaku/portfolio-site/issues/362)
- **Parent:** [#354](https://github.com/enmaku/portfolio-site/issues/354)
- **Slice type:** `overlay-vector-layer` (MINI-REVIEW-RUBRICS.md)

---

## Mandatory reading (in order)

1. world-builder/docs/SUBAGENT-OPERATING-MODEL.md
2. world-builder/docs/REWORK-PROTOCOL.md
3. world-builder/docs/MINI-REVIEW-RUBRICS.md
4. world-builder/docs/PHASE-5-MASTER-PLAN.md
5. world-builder/docs/OVERLAY-LAYER-LOCALITY.md
6. world-builder/docs/ADR-0009-COMPLIANCE-CHECKLIST.md
7. world-builder/docs/plans/ISSUE-362.md

---

## Scope boundary

### Files you MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.js
- world-builder/renderer/mapLayerRefresh.js
- world-builder/renderer/worldBuilderMapViewportModel.js
- world-builder/resourceOverlays.js
- world-builder/renderer/resourceRasterOverlayRefresh.js
- world-builder/renderer/**/*.test.js

### Files you MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/core/derivedGeographyPipeline.js

### Out of scope

Settlement, trade routes, full logistics pass, culture engine, history log, new branch, major UI redesign, closing GitHub issues.

---

## Deliverable

Execute **every** sub-sub-step in [plans/ISSUE-362.md](../plans/ISSUE-362.md):

1. 362.1 — Extend `MapLayerId` type: `coastalNodes`, `metalNodes`, `saltNodes`.
2. 362.2 — Add `vectorLayerId` to resource overlay definitions.
3. 362.3 — Rewrite `diffResourceOverlayMapLayers` — no monolithic `vectorOverlays`.
4. 362.4 — Rewrite `diffWorldDocumentMapLayers` — coastal → `coastalNodes` only.
5. 362.5 — Split viewport draw: independent groups per vector layer family.
6. 362.6 — Register handlers in `mapLayerRefresh.js` per vector layer.
7. 362.7 — Migration: remove `vectorOverlays` from production paths (grep gate).
8. 362.8 — Raster regression: existing overlay sync tests still pass.
9. 362.9 — Mini thermo: toggling salt must not call coastal draw handler.

Hand off to parent when all steps complete — **do not** claim the GitHub issue closed.

---

## AutoVerify (run all, paste output)

```bash
git diff --name-only
npx eslint --max-warnings 0 <changed-files>
npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js
npm run test:world-builder -- world-builder/renderer/
wc -l <changed-production-files>
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
```

Self-check against **MINI-REVIEW-RUBRICS.md § `overlay-vector-layer`** before handoff.

---

## Acceptance criteria (verbatim)

- [ ] Toggling salt node visibility refreshes only salt vector layer (+ any shared infrastructure explicitly documented), not coastal or metal markers.
- [ ] Toggling metals visibility refreshes only metal vector layer when nodes are visible.
- [ ] Raster overlay locality from Phase 4 remains unchanged (regression tests pass).
- [ ] Deprecated per-overlay viewport mutators remain absent.
- [ ] eslint clean on changed renderer files.

---

## Definition of done

- [ ] All sub-sub-steps complete
- [ ] AutoVerify output pasted to parent
- [ ] Self-review checklist against MINI-REVIEW-RUBRICS § `overlay-vector-layer` attached
- [ ] ESLint clean on every changed file
- [ ] Tests green for paths listed above
- [ ] No drive-by edits outside MAY touch list
- [ ] **Do NOT** mark GitHub issue complete — parent launches reviewer subagent

---

## Reviewer handoff

Parent will launch a **readonly reviewer** with:

> Apply thermo-nuclear + architecture rubrics to files changed in #362. MINI-REVIEW-RUBRICS.md § `overlay-vector-layer`. Verdict: PASS or REWORK.

On REWORK: fix **all** findings, re-run full AutoVerify, max 3 cycles.

---

## Previous review findings (if REWORK)

*(Parent fills on retry)*

---

## Related

| | |
|---|---|
| Sub-plan | [plans/ISSUE-362.md](../plans/ISSUE-362.md) |
| Rework protocol | [REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md) |
| Operating model | [SUBAGENT-OPERATING-MODEL.md](../SUBAGENT-OPERATING-MODEL.md) |
