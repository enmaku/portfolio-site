# File size budget — World Builder production code

Line-count limits for Phase 5 ([#354](https://github.com/enmaku/portfolio-site/issues/354)) and ongoing maintenance. Audit issue: [#372](https://github.com/enmaku/portfolio-site/issues/372). Thermo-nuclear instant REWORK: any production file **>1000 lines** without explicit PR justification ([`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md)).

Count production lines with:

```bash
wc -l path/to/file.js
```

Exclude `*.test.js` from budget enforcement unless a test file itself exceeds readability thresholds (rare; split fixtures instead).

---

## Hard ceilings

| Tier | Max lines | Consequence |
| --- | ---: | --- |
| **Absolute max** | 1000 | Instant REWORK; must split before merge |
| **Orchestrator max** | 650 | `#361` acceptance — `derivedGeographyPipeline.js` |
| **Substep module max** | 250 | `#356` per-file extract targets |
| **Registry / index max** | 80 | Import-only registries (`substeps/index.js`) |
| **Small helper max** | 80 | Single-purpose extract (`cloneWorldDocument.js`, `buildWorldDocumentFromPipelineState.js`) |

---

## Budget by file type

### Landmass pipeline orchestrator

| File | Budget | Notes |
| --- | ---: | --- |
| `world-builder/core/derivedGeographyPipeline.js` | ≤650 | Thin dispatch + re-exports after #361 |
| `world-builder/core/landmassPipelineRunner.js` | ≤300 | Retry, hooks, step loop (#361 extract) |
| `world-builder/core/buildWorldDocumentFromPipelineState.js` | ≤70 | Document assembly only |
| `world-builder/core/cloneWorldDocument.js` | ≤80 | Deep copy including `Uint8Array` fields |

### Landmass stage modules

| File pattern | Budget | Notes |
| --- | ---: | --- |
| `world-builder/core/stages/*Stage.js` | ≤400 | One stage per file (#359) |
| `world-builder/core/landmassPipelineStageModules.js` | ≤120 | Ordered registry |

### Hydrology substeps

| File pattern | Budget | Notes |
| --- | ---: | --- |
| `world-builder/core/hydrology/substeps/hydrologyFillSubstep.js` | ≤250 | |
| `world-builder/core/hydrology/substeps/hydrologyRouteSubstep.js` | ≤250 | |
| `world-builder/core/hydrology/substeps/hydrologySettleSubstep.js` | ≤250 | |
| `world-builder/core/hydrology/substeps/hydrologyPaintSubstep.js` | ≤250 | |
| `world-builder/core/hydrology/substeps/hydrologyClimateSubstep.js` | ≤200 | |
| `world-builder/core/hydrology/substeps/hydrologySeasonalSubstep.js` | ≤200 | |
| `world-builder/core/hydrology/substeps/hydrologyInciseSubstep.js` | ≤200 | |
| `world-builder/core/hydrology/substeps/hydrologyExtractSubstep.js` | ≤200 | |
| `world-builder/core/hydrology/substeps/hydrologyRefineSubstep.js` | ≤200 | |
| `world-builder/core/hydrology/substeps/index.js` | ≤80 | Import-only registry |
| `world-builder/core/hydrology/hydrologySubsteps.js` | ≤400 | Typed runner after #355 |
| `world-builder/core/hydrology/baselineDrainageFromState.js` | ≤60 | Helper extract |

**Deleted by #356:** monolithic `hydrologySubstepModules.js` (shim re-export only if temporarily required).

### Renderer / viewport

| File | Budget | Notes |
| --- | ---: | --- |
| `world-builder/renderer/createWorldBuilderMapViewport.js` | ≤600 | Split refresh helpers if growth continues |
| `world-builder/renderer/mapLayerRefresh.js` | ≤300 | Per-layer handler registry |
| `world-builder/renderer/diffResourceOverlayMapLayers.js` | ≤200 | Locality diffs |
| `world-builder/renderer/worldBuilderMapViewportModel.js` | ≤250 | Pure view-model resolvers |

### Page / composables

| File | Budget | Notes |
| --- | ---: | --- |
| `src/pages/projects/WorldBuilderPage.vue` | ≤400 | Markup-heavy; logic in controller (#368) |
| `src/composables/useWorldBuilderPageController.js` | ≤350 | App seam |
| `world-builder/worldBuilderPageModel.js` | ≤300 | Display format helpers |
| `src/composables/useWorldBuilderGeneration.js` | ≤250 | Generation wiring |
| `src/composables/useWorldBuilderOverlayState.js` | ≤200 | Overlay owner |

### Worker

| File | Budget | Notes |
| --- | ---: | --- |
| `world-builder/worker/derivedGeography.worker.js` | ≤80 | Message handler only |
| `world-builder/worker/derivedGeographyWorkerProtocol.js` | ≤200 | Types + serializers |

---

## Warning thresholds (#372 audit)

Flag in PR body when exceeded; split in same Phase or justify:

| Threshold | Action |
| --- | --- |
| >600 lines | Review for extract candidate |
| >800 lines | Split required before #382 unless documented exception |
| >1000 lines | Block merge — split mandatory |

Audit command:

```bash
find world-builder src/pages/projects/WorldBuilderPage.vue src/composables/useWorldBuilder*.js \
  -name '*.js' -o -name '*.vue' 2>/dev/null | while read -r f; do
  case "$f" in *.test.js) continue ;; esac
  wc -l "$f"
done | sort -n | tail -25
```

---

## What counts as production

**In budget:**

- All `world-builder/**/*.js` except `*.test.js`
- `src/composables/useWorldBuilder*.js`
- `src/pages/projects/WorldBuilderPage.vue`

**Out of budget:**

- `world-builder/docs/**`
- `*.test.js` (behavioral tests may be long; split fixtures if unreadable)
- Generated or vendor files (none in world-builder today)

---

## Splitting guidelines

When a file approaches budget:

1. Extract pure functions to colocated helper with single responsibility.
2. Move stage bodies to `stages/` or `substeps/` modules — keep orchestrator as registry + dispatch.
3. Do not split along arbitrary line boundaries; split by **seam** (see [`ARCHITECTURE-SEAMS.md`](./ARCHITECTURE-SEAMS.md)).
4. Update imports repo-wide; run `npm run test:world-builder`.
5. Record new file in this budget table via follow-up doc PR if permanent.

---

## Phase 5 acceptance (#372)

- [ ] No production file on branch exceeds 1000 lines without PR justification
- [ ] `hydrologySubstepModules` monolith eliminated (#356)
- [ ] `derivedGeographyPipeline.js` ≤650 lines (#361)
- [ ] Substep files respect per-substep caps (#356)
- [ ] Audit summary in merge PR body (#382)

---

## Automated check

```bash
npm run check:world-builder-file-size
```

Also runs at the start of `npm run test:world-builder`. Unit tests in `world-builder/scripts/checkFileSizeBudget.test.js` run under `npm test`.

---

## PR body snippet (for #382 merge PR)

Paste after running `npm run check:world-builder-file-size`. Replace warning rows with current CLI output.

```markdown
## File size audit (#372)

- [ ] `npm run check:world-builder-file-size` — exit 0
- [ ] No production file exceeds 1000 lines
- [ ] `derivedGeographyPipeline.js` ≤650 lines (orchestrator)
- [ ] `hydrology/substeps/index.js` ≤80 lines (registry)
- [ ] Hydrology substep modules ≤250 lines each (#356)
- [ ] `hydrologySubstepModules.js` is shim re-export only (#356)

**Warnings (>600 lines — extract candidates, flag for follow-up):**

| File | Lines | Action |
| --- | ---: | --- |
| *(paste from CLI or none)* | | review / split before #382 if >800 |

**Phase 5 caps verified:** `world-builder/scripts/checkFileSizeBudget.test.js`
```

---

## Related documents

| Document | Role |
| --- | --- |
| [`PHASE-5-MASTER-PLAN.md`](./PHASE-5-MASTER-PLAN.md) | Issue #372 in wave D |
| [`MERGE-GATES.md`](./MERGE-GATES.md) | File size gate in #378 |
| [`plans/ISSUE-356.md`](./plans/ISSUE-356.md) | Substep extract line caps |
| [`plans/ISSUE-361.md`](./plans/ISSUE-361.md) | Orchestrator decomposition caps |
