# Pet base stats: programmatic sources under ORC/OGL

Research for issue #517 (CritCrafter Pets tab map, #508). Question: for animal companions, the 15 eidolon types and construct companions, what is the easiest legitimate programmatic source, and what would extraction take? Starting point: `docs/critcrafter/research/pet-base-data.md` (branch `research/pet-base-data`, #511), not re-derived here.

**Short answer:** one source covers all three data sets in structured form: the Foundry module **PF2e Companion Compendia** (`TikaelSol/PF2e-Animal-Companions`, 108 animal companion ancestries, 15 eidolons, the remastered Prototype Construct companion, advancement and specialization features, every row tagged ORC or OGL). It reproduces Pathbuilder's Pets screen for every animal and eidolon number checked. Pf2eTools is a good second source for legacy animals and for a cross-check test. Foundry's own `pf2e` system has none of this data. Hand work is needed only for a handful of gap rows noted below (three animals newer than the module, licence-tag review, legacy-vs-remaster advancement differences).

## Sources and method

| Source | Pinned at | How read |
| --- | --- | --- |
| Foundry `foundryvtt/pf2e` | local checkout `a70593f7d52ba6357c3bdc05c09dcb9d4f2765dc` (the ingest pin); GitHub tree of branch `v14-dev` listed with the API (47,326 paths) | JSON scans and a full-tree path search |
| Companion Compendia module `TikaelSol/PF2e-Animal-Companions` | `d73c3f6ed507c582a454217c713b3466019f57d6` (2026-11-15), shallow clone | JSON scans of `packs/` |
| Pf2eTools `Pf2eTools/Pf2eTools` | branch `dev`, `9fab2be36f4e8f036e868b67c055ebee68d2acc9` (2026-10-25) | `data/companionsfamiliars.json`, `quickrules.json`, `sources.json`, class and feat files |
| pf2ools-data `Pf2ools/pf2ools-data` | `master`, last commit 2025-11-02 | full tree listing |
| Archives of Nethys (AoN) | public Elasticsearch index `aon-20261116-195046` | counts, names, and reading rules text as an oracle only |
| Ground truth | #509 and #510 (Pathbuilder Pets screens), fixture `many-pets-oracle.json` | compared numerically |

Data directories were treated as untrusted input and read only with `python3 -I`. Nothing from Pathbuilder's data files was used as a data source; only the animal and eidolon **names** in `.probe/assets/data_remastered80.json` and `data137.json` were compared, to measure coverage.

## Candidates, one by one

### 1. Foundry `pf2e` system source and packs: no

- The full GitHub tree has **no companion or eidolon code and no static data**. Outside `packs/`, the only hits for "companion", "eidolon", "animal" or "construct" are `src/module/actor/familiar/*` and icons. The system has no animal companion, eidolon or construct companion actor type, so the sparse local checkout is not hiding anything. (This settles the caveat left open in #511.)
- Packs hold only: the `Cat` ancestry and "Animal Companion" class item embedded in four pregens, per-type eidolon prose (`class-features/summoner/*-eidolon.json`, regular enough to parse), and prose-only feats. Bestiary NPCs such as `pathfinder-npc-core/creature-companions/*` are monsters, not base data.
- The remastered Guns & Gears is in the packs (674 docs, ORC, `remaster: true`) but the prototype construct's stat block is not: `prototype-companion.json` says only "You gain a prototype construct companion."
- Still the right source for **licence tags** and for a **cross-check** of eidolon prose (below).

### 2. Companion Compendia module (`TikaelSol/PF2e-Animal-Companions`): yes, primary

- **What it is:** a free Foundry module, last commit 2026-11-15 (about one week before this research), "verified" on Foundry 14, changelog entries every few weeks since 2022 (v6.2 added Pactbreaker's Chetamog; v6.0 added Rage of Elements). 11 stars, one maintainer, so bus factor is a risk.
- **Format:** Foundry `Item` JSON, one file per row, extracted from compendium packs (`extract-packs.mjs`). Packs duplicate for Starfinder (`sf-*`), which can be ignored.
- **Coverage** (pf2e variants only):

| Pack | Rows | Content |
| --- | --- | --- |
| `ac-ancestries-and-class` | 108 animal ancestries (plus 2 helper items) | per animal: `hp`, `size`, `speed`, `reach`, `vision`, ability mods, skill rank, extra Speeds, Strike rule elements (damage dice, type, traits), links to support benefit and advanced maneuver |
| `ac-feats` | 30 | Mature, Nimble, Savage, Specialized, Unseen, Indomitable, and the specializations (Ambusher, Bully, Daredevil, Racer, Tracker, Wrecker and others) as rule elements |
| `ac-support-benefits`, `ac-advanced-maneuvers`, `ac-effects` | about 104, 104, 94 | prose plus effects |
| `ac-features` | about 156 | including the shared **Animal Companion** feature (proficiencies, barding, item-bonus limits) and the shared **Eidolon** feature |
| `ac-eidolons` | 15 | all 15 eidolon types incl. Aberrant, Ooze, Swarm, Elemental |
| `ac-construct-companions` | 7 | Prototype Construct ancestry, Unarmed Strike 1 and 2, Advanced, Incredible and Paragon Construct, Megaton Strike |
| `ac-features` (item "Construct Companion") | 1 | Guns & Gears, ORC, remaster: Str +3, Dex +3, Con +2, Int -4, Wis +1, d8 strike override, 17 immunities |
| `ac-construct-breakthroughs` | 18 | legacy (OGL) initial and later modifications |
| `ac-evolution-feats`, `ac-followers` | 34, 12 | eidolon evolution feats; commander followers |

- **Licence and tagging:** every pack row carries `system.publication` with `title`, `license` (`ORC` or `OGL`) and `remaster`, the same shape our ingest already reads from Foundry. In the 108 ancestries: 55 ORC remaster, 10 ORC non-remaster, 37 OGL legacy, 6 OGL remaster. The repository ships `licenses/Open RPG Creative license.md` (ORC notice with Section 15 attribution for Player Core, Pactbreaker and Howl of the Wild), `licenses/OpenGamingLicense.md`, and the Apache-2.0 text; `package.json` declares `Apache-2.0` for the code. There is no separate statement about the data files, so the basis is Paizo's ORC/OGL on the rules text plus the maintainer's Apache-2.0 on the encoding. GitHub's API reports no licence for the repo because the licence files sit in `licenses/`, not the root.
- **Caveat on tags:** the per-row tag is not always the book that matches the numbers. Dragon and Fey eidolons are tagged `Secrets of Magic / OGL / remaster false`, yet their ability mods (Dragon Con +1, Int +1, Cha +1) are the Impossible Magic remaster values (Foundry tags those `Impossible Magic / ORC`). Construct and Psychopomp go the other way (module IM/ORC, Foundry SoM/OGL). Use the module for numbers and set the licence tag per row from a reviewed table, cross-checked against Foundry `publication`.
- **Extraction work:** rule elements, not flat fields. To get a stat block you read `ActiveEffectLike` on `system.abilities.<x>.mod` and `system.skills.<x>.rank`, `BaseSpeed` per movement type, `Strike` for attacks and `DamageDice` for riders, plus the ancestry's `hp`, `size`, `speed`, `vision`. This is a bounded script (one pass over about 108 files, about 2 hours of work plus tests), run by a developer, with the output committed as the JSON tables #516 decided on. It does not need to run at ingest time and **must not**: the module's version string is `dev`, its rule-element schema follows Foundry/pf2e migrations, and a build-time dependency on a third-party repo would make deploys non-reproducible.
- **Update cadence:** new Paizo companions land weeks to months later. Missing today, relative to Pathbuilder's remaster list: `Cu Sith`, `Giant Dragonfly`, `Unicorn` (all Feybound, released 2026-11-04). `Boarhound` is the module's `Isgeri Boarhound` (Hellbreakers), a name mismatch, not a gap.

### 3. Pf2eTools (`Pf2eTools/Pf2eTools`): yes for legacy animals and as a cross-check, not primary

- **Format:** `data/companionsfamiliars.json` with flat, well-typed fields: `hp`, `abilityMods`, `size[]`, `speed{}`, `senses{}`, `skill`, `attacks[]`, `support`, `maneuver`, `remaster`, `source`. Also `companionAbility` (Mature, Nimble, Savage and the six specializations, for CRB and Player Core, as prose lists with a `tier`) and `eidolon` (12 types with `stats[].abilityScores`, `ac{number,dexCap}`, `skills`, `senses`, `speed`, `size`).
- **Coverage (branch `dev`):** 61 companions (CRB 8, APG 8, Player Core 16, Rage of Elements 6, Grand Bazaar 5, adventure books, ...), 12 of 15 eidolons (**no Aberrant, Ooze or Swarm**; its `eidolon` rows are the original Secrets of Magic ones, not Impossible Magic), no Howl of the Wild, no Tian Xia, no Pactbreaker, no Riding Tarantula. AoN lists 123 animal companions, so Pf2eTools covers about half. No construct companion data (`class-inventor.json` points to "page 32" but holds no stat block; there is no Guns & Gears book file). Branch `main` is older (55 companions); use `dev`.
- **Licence:** code is MIT. Data is Paizo text. `data/sources.json` tags every source `license: ORC` or `OGL` (CRB, APG, SoM, RoE, G&G, Grand Bazaar OGL; Player Core, Player Core 2 and Shining Kingdoms ORC) with Section 15 lines. Pf2ools (the sister project) states it reproduces Paizo content under Paizo's **Community Use Policy**, which is a different, non-commercial permission, so for us the ORC/OGL status of the underlying book is the basis, and the repository is only a convenient copy.
- **Use:** the second opinion that makes a test possible (`test: module row == Pf2eTools row` for the overlapping 50-odd legacy and Player Core animals), and the source of the legacy CRB advancement text (`quickrules.json`, CRB "Animal Companions" with Young, Mature, Nimble, Savage, Specialized and the ten specializations as readable sections).

### 4. pf2ools-data: no

MIT scripts, Paizo content "in accordance with the Community Use Policy". Datatypes present: background, condition, divineIntercession, event, familiarAbility, relicGift, skill. **No animal companion, eidolon or construct datatype.** It does have `familiarAbility` (59 rows, tagged per source), which could cross-check the 117-row Foundry `familiar-abilities` pack the ingest decision (#516) already settled.

### 5. Paizo official ORC downloads: not found

I found no official Paizo SRD, reference document or machine-readable data file for the Pathfinder remaster. The ORC licence text itself (azoralaw.com/orclicense) is only a PDF. Paizo's own pages (`paizo.com/orclicense`, `paizo.com/licenses`) returned HTTP 403 to the fetcher, so what Paizo says on its site was not checked directly. If an official data release exists it would beat everything above on provenance; worth one manual look by the owner.

### 6. Archives of Nethys: fallback only

- **Content:** the richest and most current (123 animal companions, 26 eidolons, "Prototype Construct Companions" both legacy and remastered, Feybound companions two weeks old). Reachable at a public Elasticsearch endpoint with structured numeric fields on companions (`hp`, `strength`, ... ), but eidolon and construct rows are markdown only.
- **Terms:** the AoN licences page reproduces the OGL 1.0a, lists its own notice ("The Archives of Nethys. Copyright 2010, Blake Davis."), says Paizo content is used "under Paizo's Community Use Policy", and says "We are expressly prohibited from charging you to use or access this content." It states nothing about scraping, the API or who owns the compilation, and links no terms of use. Paizo has publicly said its commercial licence with AoN ended and AoN continues under the Community Use Policy. So AoN's right to the text is a **CUP permission, not ORC/OGL**, which matches ADR 0031: its licence does not pass to us. Reading the underlying book text is not the problem; AoN's compilation and any CUP-bound content (registry, free-access condition) are.
- **Use here:** oracle for human checks only (done below for the Prototype Construct and Riding Tarantula source book). Never fetch at ingest and never copy.

### 7. Other

- The module's repo and Foundry's are the only structured sources I found with a per-row ORC/OGL tag. Community SRD datasets other than Pf2eTools/pf2ools-data did not turn up in a GitHub repository search. No Foundry compendium zips or other module packs were needed.

## Cross-check against Pathbuilder ground truth

Formula checked for animal companions: HP = ancestry HP + (6 + Con mod) x level (stated in the CRB "Young Animal Companions" text in Pf2eTools `quickrules.json`).

| Pet (many-pets Oracle, level 7, young) | Source row | Ancestry HP | Con | Computed HP | Pathbuilder HP |
| --- | --- | --- | --- | --- | --- |
| Scorpion | module (Player Core, ORC) and Pf2eTools PC1 | 6 | +1 | 6 + 7 x 7 = 55 | 55 |
| Beetle | module (Grand Bazaar, OGL) and Pf2eTools LOTGB | 8 | +3 | 8 + 9 x 7 = 71 | 71 |
| Riding Tarantula | module only (Howl of the Wild, ORC) | 4 | +1 | 4 + 7 x 7 = 53 | 53 |

Also matching: ability mods for all three (Scorpion +3/+3/+1/-4/+1/+0, Beetle +3/+1/+3/-4/+1/+0, Tarantula +2/+3/+1/-4/+2/+0), Speeds (30; 35; 30 and climb 30), sizes (Small; Medium; Large), senses (darkvision; low-light vision; darkvision), and attack dice (1d6+3 stinger and pincer; 1d8+3 mandible and 1d6+3 foot; 1d6+2 fangs and 1d4+2 leg). AC 22 for Scorpion = 10 + Dex 3 + level 7 + trained 2 (and 20 and 22 for the others) also follows from the table. **Riding Tarantula exists in neither Foundry's packs nor Pf2eTools**; the module is the only programmatic source that has the animal Pathbuilder actually exported.

**Eidolon** (level 1 dragon, #509): module Dragon Eidolon has Con +1, Int +1, Cha +1 (Wis 0), Medium, Speed 25, darkvision; its shared **Eidolon** feature offers two presets `{str 4, dex 2, item 2, dexCap 3}` and `{str 2, dex 4, item 1, dexCap 4}`. Pathbuilder shows Str +4, Dex +2, Con +1, Int +1, Wis +0, Cha +1, AC 17 = 10 + level 1 + trained 2 + Dex 2 + item 2. The first preset reproduces it exactly. The same two presets appear in Foundry's Swarm Eidolon text ("Brazen Swarm ... +2 AC (+3 Dex cap)", "Slinking Swarm ... +1 AC (+4 Dex cap)") and in Pf2eTools' legacy `ac`/`dexCap` rows, so three sources agree.

**Construct** (level 1 Prototype Construct, #509): the module's Prototype Construct ancestry has HP 10, Medium or Small (choice), Speed 25, no senses; its "Construct Companion" feature (Guns & Gears, ORC, remaster) adds Str +3, Dex +3, Con +2, Int -4, Wis +1 and overrides the unarmed die to d8, while "Unarmed Strike 1" (1d8 bludgeoning) and "Unarmed Strike 2" (1d6 slashing or piercing, choice, agile finesse) hold the two strikes. Pathbuilder shows HP 18, abilities +3/+3/+2/-4/+1/+0, Speed 25, Fist 1d8 B and Spike 1d6 (agile, finesse), no senses. HP 10 + (6 + Con 2) x 1 = 18 agrees. AoN's "Prototype Construct Companions (Remastered)" rules text (oracle only) says the same.

## Recommendation per data set

### 1. Animal companions: **extract from the Companion Compendia module, cross-check against Pf2eTools, fill four gaps by hand**

- **Per-animal base rows (hp, size, speed, ability mods, skill, senses, attacks, support benefit, advanced maneuver name, licence):** extract with a one-off script from `packs/ac-ancestries-and-class`, `ac-support-benefits` and `ac-advanced-maneuvers`, pinned to a module SHA recorded in the table header. 108 animals cover 59 of 59 names in Pathbuilder's legacy list and 61 of 65 in its remaster list.
- **Licence tag:** copy `system.publication` from the module row, then verify the title against Foundry or the Pf2eTools `sources.json` entry for animals that exist there (all differences found so far were on eidolons, not animals).
- **Advancement (Young, Mature, Nimble, Savage, incredible) and the specializations:** these are about 15 small rule sets, not 108. Extract the numbers from `ac-feats` (each is a short list of `ActiveEffectLike` / `DamageAlteration` rules) and check them against the prose in Pf2eTools `companionAbility` (Player Core and CRB) and `quickrules.json` (CRB). Do **not** auto-generate from prose.
- **Gaps:** (a) the three Feybound animals (add by hand or wait for the module); (b) the `Boarhound` to `Isgeri Boarhound` alias; (c) legacy vs remaster advancement differences: the module holds one version of Mature, Nimble, Savage and Specialized (the Player Core one), while CRB Nimble also raises unarmored defense to expert and Player Core Nimble does not (Pf2eTools carries both texts), so legacy-tagged animals need a rule-set switch or an explicit decision; (d) no Pathbuilder ground truth exists for any non-young companion (all three Oracle pets are Young), so mature, nimble, savage, specialized and incredible numbers are unverified until the owner captures one screenshot of each.
- **Basis:** ORC for Player Core, Howl of the Wild and later books; OGL 1.0a for CRB, APG, Grand Bazaar and other legacy rows; per-row tags carried through.

### 2. Eidolon types: **extract from the module for numbers; use Foundry prose as the drift test; keep the 2 presets as constants**

- Source for Con/Int/Wis/Cha, skills, senses, speed, size, tradition: `ac-eidolons` (15 types, includes Aberrant, Ooze, Swarm, Elemental that Pf2eTools lacks).
- Source for Str/Dex/AC/Dex cap: the two shared presets above (a 2-row constant, corroborated by three sources).
- **Drift test:** the "Eidolon Attributes Con +x, Int +x, Wis +x, Cha +x" line in Foundry's `class-features/summoner/*-eidolon.json` is regular. A test that parses only that line (not the HTML at ingest, per #516) and compares with the committed table would pass today (I compared the 13 types where both sources have the line by hand and found no differences); Swarm and Elemental have no such line (Swarm has the two presets; Elemental varies by element) and need a hand check.
- **Licence rows:** set per row from Foundry `publication` (Impossible Magic ORC for most; Secrets of Magic OGL for Construct and Psychopomp; Rage of Elements OGL for Elemental; Battlecry! ORC for Swarm), not from the module tag (see the caveat above).
- **Not needed:** AC and dex cap are not in the Foundry packs, but they are covered by the presets.

### 3. Construct companions: **extract from the module (7 rows plus the Construct Companion feature); transcribe only what it lacks**

- The module encodes the whole prototype construct in the remastered Guns & Gears (ORC): ability mods, d8 and d6 strikes, 17 immunities, ancestry HP 10, size choice, Speed 25, plus Advanced, Incredible and Paragon Construct feats (rule elements) and Megaton Strike. Foundry's packs, Pf2eTools and pf2ools-data do not have the stat block, so the module is the only programmatic source; verified against the level 1 Pathbuilder ground truth (HP 18, abilities, strikes, Speed 25). A construct companion's saves, AC and Perception are derived from the master and need no table.
- Remaining by-hand items: the numbers each advanced/incredible/paragon feat applies (short rule-element lists: extract, then check against the book text); the **initial and later modifications** (18 legacy OGL rows in `ac-construct-breakthroughs`; remastered G&G modifications are not in the module). Pathbuilder does not export the chosen modification (#509), so these only matter as display text, which Foundry's ingested `construct-innovation` description already supplies.
- Licence: each module row carries its own tag (G&G remaster ORC for the companion rows, OGL non-remaster for the breakthroughs); verify against Foundry's `publication` (`construct-innovation.json` OGL non-remaster; remastered G&G documents ORC).
- Rage of Elements adds an Elemental eidolon and elemental animal companions, not a construct companion; the module has all of them.

## What this changes in the decision log

- #516 left "hand-transcription is a last resort, pending this research". Result: transcription is needed only for a handful of gap rows (three newest animals, licence-tag review, legacy-vs-remaster advancement differences), not for 108 animals, 15 eidolons or the construct.
- The earlier assumption that the Foundry `src/` might hold the animal data is false (full tree searched).
- Build the tables with a **committed script plus pinned module SHA**, not an ingest-time fetch, and add two tests: module row vs Pf2eTools row for the overlapping animals, and eidolon table vs Foundry's attributes line.

## Open risks

- **Single-maintainer dependency** for the main source. Mitigation: commit the output, pin the SHA, keep the script; if the module disappears the tables stay valid until the next Paizo book.
- **Legal:** the module's JSON encoding is the maintainer's work (Apache-2.0 code), the rules text is Paizo's (ORC/OGL). We reproduce numbers and verbatim support benefit and maneuver prose with per-row tags, as #516 already decided. The existing counsel caveats in `docs/critcrafter/LICENCE.md` (ORC share-alike boundary, Section 15 list) apply and need the Companion Compendia rows added; counsel review is still open.
- **Per-row tag accuracy** (see the eidolon mismatch above): a human review pass of the licence column is needed.
- **No ground truth** for non-young animal companions or for most eidolon types; see the gaps list.
- **Paizo's own site could not be read** (HTTP 403), so whether an official data download exists is unverified.

## Sources

- Foundry system repo: https://github.com/foundryvtt/pf2e (tree of `v14-dev`, README "Licenses" section, `packs/pf2e/...`).
- Companion Compendia: https://github.com/TikaelSol/PF2e-Animal-Companions (package listing: https://foundryvtt.com/packages/pf2e-animal-companions).
- Pf2eTools: https://github.com/Pf2eTools/Pf2eTools (`data/companionsfamiliars.json`, `data/quickrules.json`, `data/sources.json`, LICENSE.md).
- pf2ools-data: https://github.com/Pf2ools/pf2ools-data (README, `CUP.license`, `data/core/*`).
- Archives of Nethys: https://2e.aonprd.com/Licenses.aspx; search index https://elasticsearch.aonprd.com/aon/_search (read-only queries); Paizo's statement that AoN continues under the Community Use Policy: https://paizo.com/blog/archives-of-nethys.
- ORC licence text: https://azoralaw.com/orclicense/ (links to the PDF).
- Ground truth: issues #509, #510 and fixture `docs/critcrafter/fixtures/pathbuilder-exports/many-pets-oracle.json`.
