# Issue #362 — Vector overlay per-family map layer refresh

> **GitHub:** [#362](https://github.com/enmaku/portfolio-site/issues/362)  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354) — Phase 5 final merge-readiness pass  
> **Branch:** `world-builder` (no new branch)

---

## Summary

This sub-plan implements [#362](https://github.com/enmaku/portfolio-site/issues/362) under epic [#354](https://github.com/enmaku/portfolio-site/issues/354). Work follows **Implement → AutoVerify → mini thermo → mini arch → Parent QA** ([REWORK-PROTOCOL.md](../REWORK-PROTOCOL.md)). Subagents **must not** close GitHub issues.

---

## Dependency graph

### Blocked by

None — can start immediately (Wave A or parallel batch per PHASE-5-MASTER-PLAN.md).

### Blocks

- [#363](https://github.com/enmaku/portfolio-site/issues/363)
- [#369](https://github.com/enmaku/portfolio-site/issues/369)
- [#376](https://github.com/enmaku/portfolio-site/issues/376)
- [#385](https://github.com/enmaku/portfolio-site/issues/385)

---

## Slice type

**MINI-REVIEW-RUBRICS.md § `overlay-vector-layer`**

Apply thermo-nuclear and architecture mini-reviews using the rubric section matching this slice type. Any `[blocker]`, `[structure]`, or **Strong** architecture finding → REWORK.

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

## Sub-sub-steps

Complete in order. Each step gets its own mini-review cycle before proceeding.

1. 362.1 — Extend `MapLayerId` type: `coastalNodes`, `metalNodes`, `saltNodes`.
2. 362.2 — Add `vectorLayerId` to resource overlay definitions.
3. 362.3 — Rewrite `diffResourceOverlayMapLayers` — no monolithic `vectorOverlays`.
4. 362.4 — Rewrite `diffWorldDocumentMapLayers` — coastal → `coastalNodes` only.
5. 362.5 — Split viewport draw: independent groups per vector layer family.
6. 362.6 — Register handlers in `mapLayerRefresh.js` per vector layer.
7. 362.7 — Migration: remove `vectorOverlays` from production paths (grep gate).
8. 362.8 — Raster regression: existing overlay sync tests still pass.
9. 362.9 — Mini thermo: toggling salt must not call coastal draw handler.

---

## Files MAY touch

- world-builder/renderer/createWorldBuilderMapViewport.js
- world-builder/renderer/mapLayerRefresh.js
- world-builder/renderer/worldBuilderMapViewportModel.js
- world-builder/resourceOverlays.js
- world-builder/renderer/resourceRasterOverlayRefresh.js
- world-builder/renderer/**/*.test.js

---

## Files MUST NOT touch

- world-builder/core/hydrology/**
- world-builder/core/derivedGeographyPipeline.js

Additional global forbiddens (all slices):

- `world-builder/core/**` importing from `world-builder/renderer/**`
- Drive-by refactors outside this issue scope
- New product scope (settlement, culture engine, logistics pass, history log)
- Closing GitHub issues from subagent self-report

---

## AutoVerify

Run all commands; paste output to parent orchestrator.

```bash
# From repo root on world-builder branch
git diff --name-only

# ESLint — every changed .js / .vue
npx eslint --max-warnings 0 <changed-files>

npm run test:world-builder -- world-builder/renderer/createWorldBuilderMapViewport.overlaySync.test.js
npm run test:world-builder -- world-builder/renderer/

# Line counts — production files touched
wc -l <changed-production-files>

rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
```

---

## Acceptance criteria

Copied from GitHub issue body ([#362](https://github.com/enmaku/portfolio-site/issues/362)):

- [ ] Toggling salt node visibility refreshes only salt vector layer (+ any shared infrastructure explicitly documented), not coastal or metal markers.
- [ ] Toggling metals visibility refreshes only metal vector layer when nodes are visible.
- [ ] Raster overlay locality from Phase 4 remains unchanged (regression tests pass).
- [ ] Deprecated per-overlay viewport mutators remain absent.
- [ ] eslint clean on changed renderer files.

---

## Definition of done

Parent orchestrator sign-off only after **all** items below:

- [ ] Every sub-sub-step (#362.1 … #362.9) complete with mini thermo **PASS**
- [ ] Mini architecture review **PASS** (zero **Strong** unresolved)
- [ ] AutoVerify commands run; output pasted to parent
- [ ] `npx eslint --max-warnings 0` on every changed file
- [ ] Targeted `npm run test:world-builder` paths green (see AutoVerify)
- [ ] Diff matches **MAY touch** list — no drive-by edits
- [ ] Acceptance criteria checkboxes above satisfied verbatim
- [ ] No TODO/FIXME in production code introduced by this slice
- [ ] Reviewer PASS artifact attached in chat or issue comment
- [ ] Parent QA complete — parent may close [#362](https://github.com/enmaku/portfolio-site/issues/362)

---

## Out of scope (from #354)

Settlement placement, trade route generation, full logistics pass, culture engine, conflict engine, history log, major World Builder UI redesign, pixel-perfect renderer snapshots, new git branch.

---

## Related issues

| Relation | Issues |
|----------|--------|
| Parent | [#354](https://github.com/enmaku/portfolio-site/issues/354) |
| Grandparent | [#293](https://github.com/enmaku/portfolio-site/issues/293) |
| Blocked by | — |
| Blocks | #363, #369, #376, #385 |

---

## Notes

- Wave assignment and parallelization: see [PHASE-5-MASTER-PLAN.md](../PHASE-5-MASTER-PLAN.md) Part 5.
- Test seam catalog: [SEAM-TEST-CATALOG.md](../SEAM-TEST-CATALOG.md)
- Commit grouping (Wave D): [COMMIT-SLICE-MAP.md](../COMMIT-SLICE-MAP.md)
