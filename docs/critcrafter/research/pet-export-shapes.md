# What Pathbuilder exports for each pet kind

Research for issue #512 (parent map #508, CritCrafter Pets tab). Throwaway branch `research/pet-export-shapes`; not for merge.

## Evidence legend

- **[V-fixture]** verified against a real export committed or staged under `docs/critcrafter/fixtures/pathbuilder-exports/`.
- **[V-code]** verified by reading Pathbuilder's own shipped client bundle (`~/code/pathbuilder-clone/.probe/assets/pb-main.pretty.js`, a captured copy of `pb-main.js`; line numbers below refer to it). This is the first-party exporter, so it is stronger than a docs paraphrase, but I read minified Kotlin/JS and did not execute it.
- **[Inferred]** deduced from code or fixtures, not confirmed by an export that exercises it.
- Prior notes in `pathbuilder-records/docs/03-character-model.md` section 5.5 and `08-export-and-integrations.md` are secondary (they were themselves derived from the bundle). They agree with the code where they overlap; section 6 shows `"pets": []` and `"familiars": []` only.

## Headline findings

1. **The JSON export can only ever contain two pet kinds: `Animal Companion` (in `pets[]`) and `Familiar` (in `familiars[]`).** The exporter loops over every pet in the character's `hashMapPetData` and branches on the numeric `petType`: `0` goes to `pets[]`, `1` goes to `familiars[]`, and every other value is silently skipped (bundle lines 78845-78893) [V-code]. There is no code path that writes any other `type` string.
2. **The complete set of exported `type` strings is therefore `"Animal Companion"` and `"Familiar"`** [V-code]. The type string is looked up as `["Animal Companion","Familiar","Eidolon","Construct","Generic","Follower"][petType]` (the `i9x_1` table), but only indices 0 and 1 reach the output. `"Eidolon"`, `"Construct"`, `"Generic"`, `"Follower"` are internal labels that never appear in an export.
3. **Eidolons, construct companions, "other"/generic companions and followers are not exported at all** [V-code]. Real-export confirmation exists for the eidolon only: `summoner-dragon-eidolon.json` (Summoner 1) and `yggostrus.json` (Summoner 1) both have `pets: []`, `familiars: []`. For the construct, `cy-an-copperbottom.json` (Inventor 1) also has both arrays empty, consistent with the code, but note the fixture README / map says Cy'An's construct is "expected" to behave this way; the empty arrays are consistent with that but do not prove a construct was actually built on that save [Inferred for "a construct was present"].
4. **Neither array carries any numbers** (no HP, AC, saves, level, skills, attack bonuses). Field lists below are exhaustive for each kind [V-code, V-fixture].
5. **Export is gated on the character's level**: a pet is only emitted when `j9q(character, petType)` is true, i.e. the character's level is at least the level at which a pet of that type was granted (bundle line 90532) [V-code]. The semantics of the granting map (`c1m_1`) were not traced to individual feats [Inferred].

## `petType` numeric codes

Source: `xTi.cab` naming function (line 119684) and the `i9x_1` string table [V-code]. Pathbuilder's own `03-character-model.md` only records "`2` was observed for an Eidolon".

| `petType` | Internal label | UI category (line 16033) | In export? | Pathbuilder display name (internal, not exported) |
| --- | --- | --- | --- | --- |
| 0 | Animal Companion | Animal Companions | yes, `pets[]` | `[nickname - ]<Young/Mature/...> <animal>` |
| 1 | Familiar | Specific Familiars | yes, `familiars[]` | `Familiar [(nickname)]` or `<specific familiar> [(nickname)]` |
| 2 | Eidolon | Eidolons | **no** | `Eidolon [(nickname)]` |
| 3 | Construct | (inventor construct) | **no** | `[nickname - ]Prototype/Paragon/Incredible/Advanced Construct` |
| 4 | Generic | Other Companions | **no** | nickname, else `Other Companion` |
| 5 | Follower | (commander followers) | **no** | nickname, else `<animal> Follower` |

The save file (not the export) stores pets under `hashMapPetData` keyed by selector (`petAnimal`, `petFamiliar`, `petEidolon`, `petConstruct`, `petFollower`, ...). A captured Summoner save in the clone (`.probe/assets/char-summoner.json`) shows `"petEidolon": {"petType": 2, "petName": "Beast Eidolon", "hashMapEidolonAttacks": {...}}` [V-code/save, not an export].

## `pets[]` entry (`petType` 0, `Animal Companion`)

Serializer `CharacterJson.AnimalObject`, nine fields, fixed order (line 78214) [V-code]. Shape confirmed on three real entries in `many-pets-oracle.json` [V-fixture].

| Field | Type | Meaning | Source in exporter |
| --- | --- | --- | --- |
| `type` | string | always `"Animal Companion"` | `i9x_1[0]` |
| `name` | string | packed display name, see naming below | `cab()` |
| `equipment` | `[[itemName, qty], ...]` | pet's carried items; names resolved against item table | `h1t_1`; item name via item lookup `s34_1`, qty |
| `animal` | string | base animal, e.g. `Scorpion`, `Beetle`, `Riding Tarantula` | `g41()` / `k2j_1` |
| `mature` | boolean | character has reached the mature advancement | `g9q`: any entry in `y1l_1` with level <= character level and kind `0` |
| `incredible` | boolean | character has reached the incredible advancement | `h9q`: same over `z1l_1` |
| `incredibleType` | string | `Nimble`, `Savage`, `Indomitable`, `Genie-Touched (Djinni)`, `Genie-Touched (Efreeti)`, `Genie-Touched (Marid)`, `Genie-Touched (Shaitan)`; **`Unseen` is missing from the table** (see below) | `v9x_1[j2j_1]` |
| `specializations` | string[] | specialization names, only those unlocked at the current level and of kind 0 | `y9v` filtering `a1m_1` |
| `armor` | string | pet armor item name, e.g. `Unarmored` | `a3a().j3a_1` |

Notes:

- `incredibleType` is always present, even when `incredible` is `false` ([V-fixture]: all three fixture pets are non-incredible and report `"Nimble"`, the table default). A consumer must read `incredible` first and ignore `incredibleType` when false.
- The `v9x_1` table has seven entries, but the naming code also handles code `7` as `Unseen` (line 119688: `7 === this.j2j_1 ? "Unseen " + r`). Code 7 would index past the table; in JS that yields `undefined` (no exception, so the `try/catch` fallback to `"Nimble"` would not run), so an Unseen incredible companion probably exports a missing/`null` `incredibleType` [Inferred from code; no real export of an Unseen companion].
- `mature` and `incredible` are *booleans derived from level and feats*, so a "Specialized" companion has a non-empty `specializations` array while `mature` stays whatever it is; there is no separate `specialized` flag. Specialization is expressed only by the `specializations` array being non-empty [V-code]. All three fixture pets have `[]` [V-fixture], so the element format (plain name strings, no choices) is [Inferred] from the `string[]` serializer type.
- Maturity is therefore: young = `mature:false, incredible:false`; mature = `mature:true`; incredible = `incredible:true` (`mature` presumably also true by then, [Inferred]; not seen in a fixture). Companion levels such as "nimble/savage" are not numeric ranks.
- Other advancement variants in the naming code (commercial "Tactical"/"Deft"/"Burly" flavour for Starfinder-adjacent builds, and `Robot ...` chassis animals with a parenthesised variant) exist in `cab()` but add nothing structured to the export beyond `animal` and `name` [V-code, Inferred relevance].

### `name` convention for animal companions [V-code, V-fixture]

`cab()` builds `[<nickname> - ]<tier> <animal>[ (<variant>)]`:

- tier is `Young` (default), `Mature`, or for incredible: `Nimble`/`Savage`/`Indomitable`/`Genie-Touched`/`Unseen` (`Commercial`/`Tactical`/`Deft`/`Burly` for the commercial flag);
- the nickname, when non-empty, is prefixed with ` - ` as a separator; the nickname is free text and may itself contain parentheses or hyphens;
- a trailing ` (<variant>)` is added only for the robot imitator chassis case.

Real examples [V-fixture]: `Giant Widow (Nyame) - Young Scorpion`, `Orb Weaver (Asase) - Young Beetle`, `Obaara - Young Riding Tarantula`. The animal appears again in `animal`, and the tier tells maturity, but `mature`/`incredible` are authoritative and a nickname containing ` - ` makes splitting on ` - ` ambiguous: split from the right, or better, derive tier from the booleans and use `animal` to strip the suffix [Inferred].

## `familiars[]` entry (`petType` 1, `Familiar`)

Serializer `CharacterJson.FamiliarObject`, five fields (line 78250) [V-code]. Real entries in `many-pets-oracle.json` and `taraan-skyseeker.json` [V-fixture].

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | always `"Familiar"` |
| `name` | string | packed display name, see below |
| `equipment` | `[[itemName, qty], ...]` | Not populated by the familiar branch of the exporter in the code I read (only `type`, `name`, `specific`, `abilities` are set in the `uft` branch, lines 78870-78892); always `[]` in both fixtures [V-fixture] |
| `specific` | string or `null` | specific familiar key, e.g. `Elemental Wisp (Earth)`; `null` for a plain familiar |
| `abilities` | string[] | ability names the familiar has, in order |

Notes:

- Because the exporter does not fill `equipment` for familiars (unlike animal companions), familiar `equipment` is expected to be empty always [Inferred from code; both fixtures agree].
- **Abilities** are assembled in two parts [V-code]: (1) the specific familiar's built-in abilities (`n9y`; each rendered `Name` or `Name (opt1 and opt2)`, with `&` replaced by `and` in the option list, `o9y`); (2) the player-chosen ability slots (`lch` skips as many slots as the specific familiar replaces, minus 2 for the Witch "Improved Familiar" feat), each taken as the stored selection string. In practice the array is a flat list of names; Pathbuilder does not mark which came from the specific familiar. Fixtures: `["Darkvision","Share Senses","Tattoo Transformation","Manual Dexterity"]` and `["Accompanist","Elemental","Speech","Burrower","Independent","Tough"]` [V-fixture]. Note `Speech`, `Independent`, `Elemental`, `Accompanist` are specific-familiar built-ins, `Tough`, `Burrower` are picks [Inferred from PF2e rules, not marked in the data].
- Selection values for parameterised abilities (e.g. Skilled, resistances) are stored in `hashMapSelectedFamiliarSkilled` / `hashMapSelectedFamiliarResistances` in the save; whether the export folds the chosen skill into the ability string (for example `Skilled (Stealth)`) is not exercised by any fixture [Inferred: `o9y` suggests qualifiers appear in parentheses for built-ins only].
- The Mask Familiar / Enhanced Familiar granting feats are ordinary feats; they are not recorded in the familiar object (they appear in `feats`).

### `name` convention for familiars [V-code, V-fixture]

`cab()`: if the pet has a nickname, `" (<nickname>)"` is appended to the base; the base is the **specific familiar's display name** when `specific` is set and resolves in the corpus, else the literal word `Familiar`.

- No specific, nickname `Spider Mask (Adaze)` gives `Familiar (Spider Mask (Adaze))` [V-fixture].
- Specific `Elemental Wisp (Earth)`, nickname `Erudite (Eru)` gives `Elemental Wisp (Earth) (Erudite (Eru))` [V-fixture].
- No nickname gives `Familiar` or the bare specific name [Inferred from code; no fixture].

So `name` is `<base> (<nickname>)` with the nickname itself free text that may hold parentheses. Because `specific` is exported separately, the base is recoverable exactly: if `specific` is non-null and `name` starts with it, the nickname is whatever remains inside the outer `( )`; if `specific` is null, strip the leading `Familiar (` and final `)`. This is deterministic, unlike splitting on parentheses [Inferred but straightforward].

## What exists only in `specials` / `feats`

None of these appear in `pets[]`/`familiars[]` [V-code]. Evidence from real exports [V-fixture]:

- **Dragon eidolon Summoner** (`summoner-dragon-eidolon.json`): `specials` = `Dragon Eidolon`, `Manifest Eidolon`, `Act Together`, `Share Senses`, `Summoner Spellcasting`, `Link Spells`, `Primal`, `Dragon Breath`, ...; `feats` has `Glider Form` as `"Summoner Evolution Feat"`, slot `Evolution Feat 1`. `yggostrus.json` (Summoner 1, also dragon): `specials` include `Dragon Eidolon` (twice), `Breath Weapon`, `Manifest Eidolon`, `Act Together`, `Share Senses`, `Link Spells`, `Evolution Feat`, `Wings (Dragonet)`, `Homing Drake`; feat `Energy Heart` as Summoner Evolution Feat. Two of these specials (`acid`, `Homing Drake`) show the tradition/damage choice and a named feature leak in as bare special strings [V-fixture]. So eidolon type, tradition and damage type surface only as special-name tokens, evolution picks as feats with category `Summoner Evolution Feat`.
- **Eidolon save data** (not exported): `petEidolon` with `petName` (type, e.g. `Beast Eidolon`) and `hashMapEidolonAttacks` mapping slot to `{weaponName, attackAbilityRef}` [V-code/save]. Eidolon base stats come from the `pets_eidolons` table (`ac1,dexcap1,...,array1`) [`pathbuilder-records/docs/02-data-files.md`], so the exported character has none of them.
- **Inventor construct companion** (`cy-an-copperbottom.json`): `specials` has `Construct Innovation` but no entry for the construct itself, `pets: []`, `familiars: []`. Pathbuilder keeps constructs in `petConstruct` (modifications table `Inventor Modifications - Construct`) and would name them `Prototype/Paragon/Incredible/Advanced Construct`; none of that is exported [V-code, V-fixture for emptiness].
- **Familiar granting feats/specials** also appear in `specials` (`Familiar`, `Enhanced Familiar Feat`, `Phase Familiar`, `Familiar of Flowing Script` in `taraan-skyseeker.json`) and in `feats`. These are why the Actions screen still shows a familiar group today.
- **Animal companion granting**: `many-pets-oracle.json` has special `Call Companion` and feats `Additional Companion` (twice: Archetype Feat 4 and Class Feat 6) plus `Mask Familiar`, `Adaptive Mask Familiar`; the three animal companions plus one familiar match those grants [V-fixture]. Pathbuilder does not tell you which feat granted which pet [Inferred].

## Where the existing function stands (`functions/critcrafter/assemble.js`)

[V-code, read from the main working tree]:

- Only `familiars[].abilities` are consumed: `familiarAbilities()` flattens them; each is resolved against the rules corpus (hint `familiar`) and emitted as the Familiar action group. `pets[]` is never read, and the pet `equipment` is not requested for lookup.
- `familiar_unparsed` fires only when a familiar entry lacks an `abilities` **array** (`!Array.isArray(f.abilities)`). It does **not** fire for names the function cannot parse; the function does not parse `name` at all. The ticket text on #508 ("The function already warns `familiar_unparsed` for names like these") is therefore inaccurate: none of the fixture familiars would trigger it.
- There is no warning for unknown `type` strings, and (per the exporter) none is needed for the JSON path since only two exist.

## Naming and parsing implications (decisions for later tickets)

- Do not parse `name` for anything but a display nickname; use `animal`, `specific`, `mature`, `incredible`, `incredibleType` for structured data. All of those are present as separate fields.
- Nickname extraction is possible and deterministic for both kinds (see above), but nickname text is user free text (the fixtures already contain nested parentheses and the user may type ` - `).
- Anything beyond these fields (stats, attacks, size, speeds, abilities of the animal, specialization text) must be derived from the rules corpus by the function; the export gives only identifiers.

## Open / unverified (needs an export or owner help)

1. Real export with a **mature** animal companion, an **incredible** one (each `incredibleType`), a **specialized** one (to see the `specializations` element format), and an **Unseen** incredible (predicted to export a missing/null `incredibleType`).
2. Real export of a familiar with **Skilled** / **resistance** abilities, and one without a nickname (to see the exact `name`).
3. Real export of an **Inventor with a built construct**, and an **Eidolon-with-nickname** save, to confirm they stay out of the arrays (code says so; no exercising fixture beyond empty arrays).
4. The `j9q` gating map (`c1m_1`): which feats populate which `petType` levels, and whether a pet the player deleted but whose granting feat remains is still exported.
5. Whether `equipment` on a familiar can ever be non-empty (code suggests never).
6. Custom pets (`Custom Animal Companion`, `Custom Specific Familiar`, `Custom Generic Companion`; `docs/05-feat-system.md`): the export path takes `animal` / `specific` from the pet's stored fields, so a custom name would pass through as an unknown string the corpus cannot resolve [Inferred].

## Sources

- `~/code/pathbuilder-clone/.probe/assets/pb-main.pretty.js`: serializers `CharacterJson.PetObject`/`AnimalObject`/`FamiliarObject` (lines 78179, 78214, 78250); export loop (78845-78893); `j9q` (90532); `xTi` pet class, `cab`/`k2l`/`ici`/`jci` (119684-119790); `i9x_1`/`v9x_1` tables; `g9q`/`h9q`/`y9v`/`n9y`/`lch` (118880-118975).
- `pathbuilder-records/docs/03-character-model.md` sections 5.5 and 6; `08-export-and-integrations.md`; `02-data-files.md` section 3.6; `05-feat-system.md`.
- Fixtures in `docs/critcrafter/fixtures/pathbuilder-exports/`: `many-pets-oracle.json`, `taraan-skyseeker.json`, `summoner-dragon-eidolon.json`, `yggostrus.json`, `cy-an-copperbottom.json` (the two newer ones read from the main working tree, uncommitted at time of writing).
- `functions/critcrafter/assemble.js` (main working tree).
