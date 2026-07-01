# Merge PR snapshot — file size audit (#372)

> **Purpose:** Paste-ready `#372` audit section for merge PR [#382](https://github.com/enmaku/portfolio-site/issues/382).  
> **Generated:** Ralph iteration 2, step 372.4.  
> **Command:** `npm run check:world-builder-file-size` (repo root, `world-builder` branch).

---

## Paste into PR #382 body

Copy the block below into the merge PR body under a `## File size audit (#372)` heading (or merge with the gate checklist in [`MERGE-GATES.md`](./MERGE-GATES.md) Gate 6).

```markdown
## File size audit (#372)

- [x] `npm run check:world-builder-file-size` — exit 0
- [x] No production file exceeds 1000 lines
- [x] `derivedGeographyPipeline.js` ≤650 lines (orchestrator) — **193 lines**
- [x] `hydrology/substeps/index.js` ≤80 lines (registry) — **31 lines**
- [x] Hydrology substep modules ≤250 lines each (#356) — max **137** (`hydrologySettleSubstep.js`)
- [x] `hydrologySubstepModules.js` is shim re-export only (#356) — **10 lines**

**Warnings (>600 lines — extract candidates, flag for follow-up):**

| File | Lines | Action |
| --- | ---: | --- |
| `world-builder/core/hydrology/connectNearbyRiverCorridors.js` | 604 | review for extract |
| `world-builder/core/hydrology/seededTemporaryRiverCarve.js` | 646 | review for extract |
| `world-builder/worldBuilderGenerationControls.js` | 632 | review for extract |
| `world-builder/core/hydrology/refineRiverNetwork.js` | 778 | review for extract (under 800; split before follow-up if growth continues) |

None exceed 800 lines; no split required before #382 merge. `worldBuilderGenerationControls.js` accepted under #372 criterion 4 (632 lines, metadata registry).

**Phase 5 caps verified:** `world-builder/scripts/checkFileSizeBudget.test.js`
```

---

## Raw CLI output

```
$ npm run check:world-builder-file-size

> portfolio-site@0.0.1 check:world-builder-file-size
> node ./world-builder/scripts/checkFileSizeBudget.mjs

World Builder file size budget audit
Scanned: 146 production files
Violations: none
Warnings (>600 lines, extract candidate review): 4
  world-builder/core/hydrology/connectNearbyRiverCorridors.js: 604 lines (>600, review for extract)
  world-builder/core/hydrology/refineRiverNetwork.js: 778 lines (>600, review for extract)
  world-builder/core/hydrology/seededTemporaryRiverCarve.js: 646 lines (>600, review for extract)
  world-builder/worldBuilderGenerationControls.js: 632 lines (>600, review for extract)
  Flag these in the merge PR body; split before #382 if any exceed 800 lines.
```

Exit code: **0**

---

## Key cap verification (#372.3)

| File | Lines | Budget | Status |
| --- | ---: | ---: | --- |
| `world-builder/core/derivedGeographyPipeline.js` | 193 | ≤650 | pass |
| `world-builder/core/hydrology/substeps/index.js` | 31 | ≤80 | pass |
| `world-builder/core/hydrology/hydrologySubstepModules.js` | 10 | shim only | pass |
| `world-builder/worldBuilderGenerationControls.js` | 632 | >600 warning | accepted (no >800) |

Hydrology substep modules (all ≤250):

| File | Lines |
| --- | ---: |
| `hydrologyClimateSubstep.js` | 54 |
| `hydrologyPaintSubstep.js` | 68 |
| `hydrologyFillSubstep.js` | 70 |
| `hydrologyInciseSubstep.js` | 71 |
| `hydrologyRouteSubstep.js` | 71 |
| `hydrologyExtractSubstep.js` | 72 |
| `hydrologyRefineSubstep.js` | 87 |
| `hydrologySeasonalSubstep.js` | 129 |
| `hydrologySettleSubstep.js` | 137 |

---

## Acceptance criteria (#372)

| Criterion | Status |
| --- | --- |
| No production file >1000 lines without PR justification | pass — max 778 (`refineRiverNetwork.js`) |
| `hydrologySubstepModules` monolith eliminated (#356) | pass — 10-line shim |
| `derivedGeographyPipeline` orchestrator ≤650 (#361) | pass — 193 lines |
| `worldBuilderGenerationControls` accepted or split | pass — 632 lines, flagged >600 |
| Audit summarized in merge PR body | this document |

---

## Related

- [`FILE-SIZE-BUDGET.md`](./FILE-SIZE-BUDGET.md) — budgets and PR snippet template
- [`plans/ISSUE-372.md`](./plans/ISSUE-372.md) — audit sub-plan
- [`plans/ISSUE-382.md`](./plans/ISSUE-382.md) — merge PR gate
