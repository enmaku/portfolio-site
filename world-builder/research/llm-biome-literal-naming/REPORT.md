# Biome-literal settlement naming — prompt sims

**Date:** 2026-08-13  
**Model:** `gemini-3.5-flash-lite`  
**Fixture:** cached ablation annotations (28 settlements, epoch 3, seed 42)  
**Scoring:** local heuristic (`scoreBiomeLiteralNames`) — stem hits (taiga/frost/pine/…), calques (stem+place suffix), own-biome echo  
**Pacing:** ≥8s between calls  

Harness: `world-builder/scripts/runBiomeLiteralNamePromptSims.mjs`  
Variants: `world-builder/llm/biomeLiteralNamePromptVariants.js`

## What failed in the UI

Soft instructions (“don’t do Coppersville / prefer Georgetown”) had **no useful effect** when the flavor box was empty and the live call included the region writeup. Blank-flavor + writeup + current soft wording still produced Frostwatch / Pinefall / Tundrasend-style names (~15–25% calque, ~21% stem).

A strong **author flavor** (e.g. `pirates`) mostly **masks** the problem: names become Tortuga / Cutlass / Gallows compounds instead of Taiga-/Scrub- calques. That is why early pirate-flavored sims looked “fine” while the empty-flavor UI looked broken.

## Batches run

| Tag | Flavor | Writeup | Variants × repeats | Calls (approx) |
| --- | --- | --- | ---: |
| (default) | pirates | no | 16 × 3 | 48 |
| `blank_flavor` | empty | no | 7 × 3 | 21 |
| `blank_writeup` | empty | yes (live-shaped) | 7 × 3 | 21 |

(An intermediate `empty_flavor` tag accidentally still used pirates because `LLM_BIOME_FLAVOR=` was treated as falsy; fixed in the runner.)

## Blank flavor — names only (mean of 3)

| Variant | Calque | Stem hit | Notes |
| --- | ---: | ---: | --- |
| **combined_hard_after_json** | **0.00** | **0.01** | Best: banned stems + ≥85% proper names **after** the JSON |
| instructions_after_json | 0.01 | 0.04 | Recency alone helps a lot |
| hard_forbid_stems / soft_plus_hard / mythos_then_assign | ~0.04 | ~0.04–0.05 | Strong |
| **current_ui (soft)** | **0.12** | **0.20** | Soft prefer/avoid insufficient |
| **no_anti_literal** | **0.25** | **0.43** | Baseline failure (Oakhaven, Frostreach, Pinehollow) |

## Blank flavor + writeup (mean of 3)

| Variant | Calque | Stem hit | Notes |
| --- | ---: | ---: | --- |
| **hard_forbid_stems** | **0.01** | **0.01** | Best under writeup pressure |
| mythos_then_assign | 0.01 | 0.02 | Strong |
| combined_hard_after_json / instructions_after_json / soft_plus_hard | ~0.04 | ~0.04–0.05 | Still good |
| no_anti_literal | 0.12 | 0.25 | Bad (high variance) |
| **current_ui (soft)** | **0.15** | **0.21** | Still fails (incl. Tundrasend / Frostwatch) |

## What actually moves the needle

1. **Hard banned stems** (not soft “prefer”) — list biome/commodity English and forbid substrings.  
2. **Put those rules after the annotated JSON** — recency beats instructions buried above a huge payload.  
3. **Quota / mandate** (≥85% invented person/event/opaque names) + forbid `<Biome><Town|Port|…>` pattern.  
4. **Strong flavor** is a workaround, not a fix — empty flavor is the stress test.  
5. Stripping biome fields / ids-only helps less than hard post-JSON bans (and hurts grounded writeups).  
6. Few-shot pirate anthroponyms → model **clones the examples** every run; avoid fragile exemplars.

## Live prompt change

`buildSettlementNamePrompt` now uses the winning pattern:

1. **HARD CONSTRAINT** banned-stem list + forbidden `<Biome><Suffix>` pattern **before** the JSON  
2. ≥85% invented personal/dynastic/event/opaque names  
3. **CRITICAL FINAL CHECK** after the JSON (recency) naming Oakhaven / Frostwatch / etc. as rejects  

Soft-only “prefer Georgetown” wording is gone.

### Post-change verify (blank flavor + writeup, 3 runs)

All three runs: **calque 0 / stem 0 / no banned substrings**. Samples like `Valen`, `Karn`, `Olyssa`, `Zarath`, `Aethel`, `Morvath`.

## Artifacts

- `summary.json` — pirates / names-only ranking  
- `summary-blank_flavor.json` / `summary-blank_writeup.json`  
- `results/*.json` — per-run names + scores  

Re-run:

```bash
# pirates, all variants ×3
LLM_BIOME_REPEATS=3 node world-builder/scripts/runBiomeLiteralNamePromptSims.mjs

# blank flavor stress test
LLM_BIOME_FLAVOR='' LLM_BIOME_TAG=blank_flavor LLM_BIOME_REPEATS=3 \
  LLM_BIOME_ONLY=current_ui,no_anti_literal,hard_forbid_stems,combined_hard_after_json \
  node world-builder/scripts/runBiomeLiteralNamePromptSims.mjs
```
