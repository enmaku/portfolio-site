# Commit slice map — Phase 5 (`world-builder` branch)

> **Purpose:** Group Phase 5 implementation into reviewable commits before [#376](https://github.com/enmaku/portfolio-site/issues/376) hygiene pass and [#382](https://github.com/enmaku/portfolio-site/issues/382) merge PR.
>
> **Rule:** One commit ≈ one issue slice or tightly coupled sub-slice. Reference issue numbers in subject lines. Maintainer performs commits (agent hooks block autonomous commit).

---

## Wave A — Hydrology typing and file split

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| A1 | #355 | `world-builder: typed hydrology stage outputs (#355)` | `core/hydrology/hydrologyWorldTypes.js`, `substeps/moduleTypes.js`, `hydrologySubsteps.js`, contracts |
| A2 | #356 | `world-builder: split hydrology substep modules (#356)` | `core/hydrology/substeps/*.js`, delete monolithic modules file |
| A3 | #357 | `world-builder: flow-field full-solve regression tests (#357)` | `derivedGeographyPipeline.test.js`, hydrology test comments |
| A4 | #358 | `world-builder: river mask lifecycle regression tests (#358)` | `riverMaskLifecycle.test.js`, hydrology tests |

---

## Wave B — Landmass stages and orchestrator

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| B1 | #359 | `world-builder: landmass pipeline stage modules (#359)` | `core/stages/*`, `landmassPipelineStageModules.js` |
| B2 | #360 | `world-builder: derive landmass contracts from modules (#360)` | `landmassPipelineStageContracts.js`, contract tests |
| B3 | #361 | `world-builder: decompose pipeline orchestrator (#361)` | `cloneWorldDocument.js`, `buildWorldDocumentFromPipelineState.js`, `landmassPipelineRunner.js`, slim `derivedGeographyPipeline.js` |

---

## Wave C — Renderer overlay locality

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| C1 | #362 | `world-builder: vector overlay per-family layer IDs (#362)` | `renderer/createWorldBuilderMapViewport.js`, `mapLayerRefresh.js`, overlay diffs |
| C2 | #363 | `world-builder: vector overlay locality tests (#363)` | `createWorldBuilderMapViewport.*.test.js` |

---

## Wave D — Simulation seam and consumers

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| D1 | #364 | `world-builder: fix simulation hydrology seam tests (#364)` | `*SeamContract*.test.js`, hydrology seam tests |
| D2 | #365 | `world-builder: validation uses simulation river interface (#365)` | `buildGenerationReport.js`, `runGeographyValidationChecks.js` |
| D3 | #366 | `world-builder: worker clone round-trip for simulationRiverMask (#366)` | `cloneWorldDocument.js`, worker protocol tests |

---

## Wave E — Page and overlay UX

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| E1 | #367 | `world-builder: fix overlay checkbox indeterminate state (#367)` | `resourceOverlayState.js`, `WorldBuilderPage.vue`, overlay tests |
| E2 | #368 | `world-builder: extract page display model from SFC (#368)` | `worldBuilderPageModel.js`, `useWorldBuilderPageController.js`, SFC |
| E3 | #375 | `world-builder: page controller behavioral tests (#375)` | `useWorldBuilderPageController.test.js` |

---

## Wave F — Regression guards and docs

| Commit order | Issue | Subject hint | Primary paths |
|--------------|-------|--------------|---------------|
| F1 | #369 | `world-builder: viewport tests run in npm test CI (#369)` | `package.json`, viewport tests, AGENTS.md |
| F2 | #370 | `world-builder: ADR-0009 seam contract audit (#370)` | seam contract test files |
| F3 | #371 | `world-builder: collapse redundant contract tests (#371)` | hydrology + landmass contract tests |
| F4 | #373 | `world-builder: CONTEXT simulation vs presentation vocabulary (#373)` | `world-builder/CONTEXT.md` |
| F5 | #374 | `world-builder: default generation e2e smoke (#374)` | `worldBuilder.integration.test.js` |
| F6 | #383–#386 | `world-builder: regression guards (#383 #384 #385 #386)` | targeted test fixes only |

---

## Wave G — Docs-only (may land anytime)

| Commit | Subject hint | Paths |
|--------|--------------|-------|
| Docs | `world-builder: Phase 5 planning docs` | `world-builder/docs/**` (this tree) |

Docs commits do not block code waves but should land before #376 if reviewers depend on them.

---

## Commit size guidance

| Good | Avoid |
|------|-------|
| 1 issue = 1 commit when diff < ~800 lines | Single 5000-line "Phase 5" commit |
| Test-only follow-up commit for #357–#358 | 50 one-line typo commits |
| `fixup!` locally before push; squash only if maintainer prefers | Mixing #362 renderer with #359 core in one commit |

---

## Pre-push checklist (#376)

```bash
git status          # clean working tree
git log --oneline -25   # commits grouped per table above
git push -u origin world-builder
```

---

## Related

- [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md)
- [plans/ISSUE-376.md](./plans/ISSUE-376.md)
- [MERGE-GATES.md](./MERGE-GATES.md)
