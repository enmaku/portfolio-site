# LLM settlement-name prompt ablation

**Date:** 2026-08-13  
**Fixture:** geography seed `42`, 1024×1024, 3 epoch steps after begin, flavor `pirates`  
**Settlements / factions at epoch 3:** 28 / 12 (4 rivalry edges)  
**Generator + judge:** `gemini-flash-latest` (resolved to Gemini 3.6 Flash) via Firebase AI Logic (serialized calls, ≥45s cooldown). Later live UI default: `gemini-3.5-flash-lite` — see Follow-up below.

## Method

1. Live pipeline fixture: `generateDerivedGeography` → `runBeginColonizationCommit` → 3× `runColonizationEpochStep`.
2. Cached `annotations-full.json` (~10.3k approx tokens raw).
3. Twelve prompt variants (leave-one-group-out + drills).
4. One name generation + one blind A/B judge per variant (baseline self-check = tie).

Approx prompt tokens ≈ `ceil(charLength / 4)`. Scores are 1–5 averages of flavor fit, diversity, groundedness, and faction distinctiveness (mapped so “variant” is always the ablation).

## Token / latency vs baseline

| Variant | Approx prompt tokens | Δ vs baseline | Gen latency | Judge avg (variant − baseline) | Better |
| --- | ---: | ---: | ---: | ---: | --- |
| baseline | 10624 | 0 | 20.1s | 0.00 | tie |
| no_antirepeat | 10524 | −100 | 14.8s | +0.25 | variant |
| truncate_history_3 | 10151 | −473 | 15.4s | +0.25 | variant |
| dedupe_strip_nulls | 9911 | −713 | 18.7s | −0.50 | baseline |
| politics_membership_only | 9663 | −961 | 18.8s | −0.75 | baseline |
| no_politics | 8947 | −1677 | 24.0s | +0.50 | variant |
| history_kit_only | 8717 | −1907 | 19.5s | −0.50 | baseline |
| no_history | 8099 | −2525 | 19.7s | −1.00 | baseline |
| imports_exports_only | 6133 | −4491 | 17.4s | −0.50 | baseline |
| no_economy | 5645 | −4979 | 19.9s | +0.38 | variant |
| geo_only | 1582 | −9042 | 17.3s | +1.25 | variant |
| ids_flavor_only | 840 | −9784 | 13.8s | **−1.50** | baseline |

## Where quality clearly drops

### Necessary signal: more than ids + flavor

**`ids_flavor_only`** is the quality cliff. Judge avg **3.5 vs 5.0**, groundedness **2/5**, despite strong pirate flavor.

Baseline examples (grounded): `Frostkeel`, `Blizzard Shoal`, `Plankwall`, `Sharktail Reef`  
Ids-only examples (flavorful but generic pirate stock): `Blackwater Cay`, `Deadman Reef`, `Shipwreck Point`, `Skull Spit`

Faction names stay punchy either way (`Blacktide Brotherhood`, `Isle Corsairs`), but settlement names stop reflecting biome/place cues once geography fields are gone.

### History helps groundedness (even at epoch 3)

**`no_history`** (−1.0 avg): flavor still 5, groundedness falls to **3**. Removing raw history while keeping kit notes (`history_kit_only`) is milder (−0.5). Truncating to 3 newest events (`truncate_history_3`) did not hurt in this run (+0.25).

### Politics roster / rivalries are weak for naming

**`no_politics`** was judged *better* than baseline (+0.5) with −1.7k tokens. Slimming to membership only (`politics_membership_only`) was slightly worse (−0.75) but not a cliff. Full rivalry/roster detail does not look load-bearing for place names at this depth.

## What can likely be removed or slimmed

| Change | Token impact | Quality read | Recommendation |
| --- | ---: | --- | --- |
| Drop economy (wealth/tax/tolls/supplies/wants/imports/exports) | ~−47% | Judge preferred `no_economy` | **Safe to drop** for naming |
| Keep only biome/maritime/tier/pop + ids (`geo_only`) | ~−85% | Judge preferred strongly | **Strong candidate** production shape |
| Strip null/empty JSON fields | ~−7% | Small regression (−0.5) | Worth doing; cheap encoding win with negligible risk |
| Cap history to last 3 | ~−4% | No loss here | **Safe slim** |
| Kit history only (drop raw history) | ~−18% | Mild regression (−0.5) | Acceptable if tokens matter |
| Drop anti-repetition instructions | ~−1% | Slight judge preference for variant | Keep for now — cheap, and prior pirate runs showed `*-skerry` cloning; one judge pass is weak evidence to delete |

## Example contrast packs

### Baseline vs `geo_only` (huge cut, still strong)

| | Settlements (sample) | Factions (sample) |
| --- | --- | --- |
| baseline | Gallows Reach, Frostkeel, Sharktail Reef, Plankwall | Iron Tide Brotherhood, Kraken Coast Syndicate |
| geo_only | Blackwater Bay, Frostfang Spit, Scrimshaw Reach, Pinescar Inlet | Blacktide Brotherhood, Crimson Syndicate |

`geo_only` still produces biome-aware cold/coast names (`Frostfang`, `Pinescar`, `Rimepoint`) without economy or politics blobs.

### Baseline vs `no_economy` (economy looks like noise)

| | Settlements (sample) |
| --- | --- |
| baseline | Gallows Reach, Frostkeel, Rogue Bastion |
| no_economy | Port Blackwake, Frostkeel, Timberjaw, Whalebone Spire |

Shared cold-port vocabulary without needing wealth/tolls/commodity maps.

### Baseline vs `ids_flavor_only` (cliff)

| | Settlements (sample) |
| --- | --- |
| baseline | Frostkeel, Blizzard Shoal, Plankwall |
| ids_flavor_only | Blackwater Cay, Deadman Reef, Skull Spit |

Ids-only collapses into interchangeable pirate stock phrases.

## Recommended production payload (from this study)

Keep for each settlement:

- `settlementId`, `mapNumber`, `status`, `tier`, `population`
- `biome`, `maritimeRole`, `foundedEpoch`
- `factionId`, `membershipBand` (light politics)
- short history: **last ≤3** kit notes and/or raw history kinds

Keep realm-level:

- `epoch`
- faction id list (ids only is enough)
- skip rivalry edges unless a later experiment shows faction-name benefit

Drop for naming:

- `wealth`, `factionTax`, `portTolls`, `supplies`, `wants`, commodity import/export lists
- deep faction roster fields / rivalry cause graphs
- null/empty keys in JSON

Keep instruction text including anti-repetition (tiny cost; prior manual pirate run showed suffix cloning).

Expected size: on the order of **`geo_only` (~1.6k) to light-history (~6–9k)** vs current **~10.6k** prompt tokens for this 28-settlement world — roughly **half to 85% cheaper** depending how aggressive the cut is.

## Caveats

- Single world, single seed, three epochs, one flavor (`pirates`).
- One sample per ablation (no multi-seed repeats).
- Judge is the same model family as the generator; preference for some slim variants over baseline may include noise or “cleaner prompt → punchier names” bias.
- Early colonization history is thin; history’s value may grow on older worlds.
- UI Generate button still uses the **full** payload until a follow-up deliberately adopts the slim shape.

## Follow-up: model choice (2026-08-13)

Live spike moved from `gemini-flash-latest` (**Gemini 3.6 Flash**) to **`gemini-3.5-flash-lite`**.

On project `enmaku-worldbuilder` free tier, full Flash SKUs (2.5 / 3 / 3.5 / 3.6) sit at **20 RPD**; **3.1 / 3.5 Flash Lite** sit at **500 RPD** (and higher RPM). Informal live checks after the switch: naming + region writeup quality felt **very similar**, with **noticeably lower latency** and far more headroom for iteration. Prefer pinning Lite for this workload unless a later blind compare says otherwise.

## Artifacts

| Path | Contents |
| --- | --- |
| `meta.json` | Fixture knobs + counts |
| `annotations-full.json` | Cached full annotations (gitignored; regenerate via script) |
| `results/*.json` | Per-variant names + token/latency |
| `judgments/*.json` | Blind judge raw + mapped scores |
| `summary.json` | Run summary rows |

Regenerate fixture:

```bash
node world-builder/scripts/developLlmNameAblationWorld.mjs
```

Re-run ablations (skips existing unless `LLM_ABLATION_FORCE=1`):

```bash
node world-builder/scripts/runLlmNamePromptAblation.mjs
```
