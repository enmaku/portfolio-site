# 02 — Data Files

## 1. Location and naming

All rules data lives on the CDN:

```
https://pathbuilder2e-data.b-cdn.net/data137.txt              (legacy / pre-Remaster)
https://pathbuilder2e-data.b-cdn.net/data_remastered80.txt    (Remastered)
```

The numeric suffix is a **data version**, independent of the app version. The app
requests the file matching the character's `remastered` flag. Both files are cached in
IndexedDB (`data` store) under exactly those keys.

Sizes: `data137.txt` ≈ 4.24 MB, `data_remastered80.txt` ≈ 3.93 MB (base64 text).

## 2. Encoding — LZ-string over CSV-over-JSON

The file is **not** JSON, gzip, or base64-of-JSON. It is:

```
LZString.compressToBase64( JSON.stringify( { "<tableName>": "<csv text>", ... } ) )
```

Decoding steps:

1. `LZString.decompressFromBase64(text)` → a JSON string.
2. `JSON.parse(...)` → an object with **412 keys** (245 real tables + 167
   `sqlite_autoindex_*` keys that are empty strings).
3. Each value is a **CSV document** whose first row is the column header.

The bundle's decoder is `_i(Dh).eik` (line ~32880 of the beautified bundle). It is a
faithful port of the standard LZ-string `_decompress` with `resetValue = 32` and the
base64 alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`.

Reference decoder used for this analysis:

```js
const LZ = require('lz-string');
const raw = fs.readFileSync('data_remastered80.txt', 'utf8');
const json = LZ.decompressFromBase64(raw);   // ~11.2 MB of JSON text
const tables = JSON.parse(json);             // 412 keys
```

Decoded sizes: `data_remastered80` → 11 207 444 chars; `data137` → 11 990 490 chars.

### 2.1 Why CSV inside JSON?

The source data is a SQLite database. The publisher dumped each table to CSV, then
wrapped the whole set in one JSON object, then LZ-compressed it. The `sqlite_schema`
key contains the original `CREATE TABLE` statements as CSV rows
(`type,name,tbl_name,rootpage,sql`), which is how the app knows column names and order.

### 2.2 Parsing in the app

`_i(R_).kij` iterates `Object.keys(parsed)` and, per key, calls the appropriate manager
loader. PapaParse is used for CSV parsing. Empty-string values are treated as absent.

## 3. Table inventory (245 tables)

**Volume (Remastered dataset):** 245 tables · 5 172 feats · 1 379 spells · 288
backgrounds · 38 ancestries · 28 classes.

### 3.1 Feats — 113 tables

| Pattern | Count | Notes |
| --- | --- | --- |
| `feats_ancestry_<ancestry>` | 42 | One table per ancestry (e.g. `feats_ancestry_elf`) |
| `feats_heritage_<ancestry>` | 42 | One table per ancestry's heritages |
| `feats_class_<class>` | 29 | One table per class |
| `feats_archetype` | 1 | All archetype feats, with an `archetype` column |
| `feats_general` | 1 | General + skill feats |
| `feats_aftermath_deviant` | 1 | Aftermath and Deviant feats |
| `feats_mythic` | 1 | Basic mythic feats |
| `feats_mythic_destinies` | 1 | Mythic destiny feats |

**Feat column signatures** (three variants exist):

```
18 cols: id,name,level,traits,actions,selectable,req_abilities,prof_trained,prof_expert,
         prof_master,prof_legendary,prof_magic,pet,req_feats,req_specials,text_descrip,src,url
20 cols: ... + text_prereq,text_req   (before text_descrip)
20 cols: id,type,archetype,name,req_feats,level,traits,actions,text_descrip,selectable,
         req_abilities,prof_*,pet,req_specials,src,url   (feats_archetype only)
```

Field semantics:

| Column | Meaning |
| --- | --- |
| `id` | Stable key, `"<PREFIX>_<Name>"` e.g. `WIZARD_Counterspell`, `HUMAN_Versatile Heritage` |
| `name` | Display name |
| `level` | Feat level (1–20) |
| `traits` | Comma-separated traits (`"Arcane, Wizard"`) |
| `actions` | Action cost. **Verified mapping** (spell `actions` is 1-offset from the internal enum): `"-1"` = free action, `"0"` = reaction, `"1"`/`"2"`/`"3"` = 1/2/3 actions, `"4"` = 1–3 actions, `"5"` = 1–2 actions, `"7"` = 2–3 actions, `""` = none |
| `selectable` | Non-empty if the feat opens a sub-selection dialog |
| `req_abilities` | Ability prerequisites |
| `prof_trained`/`prof_expert`/`prof_master`/`prof_legendary` | Proficiencies granted |
| `prof_magic` | Magic tradition proficiency granted |
| `pet` | Pet/companion granted |
| `req_feats` | Required feat IDs, `&`-separated |
| `req_specials` | Required special names |
| `text_prereq` | Prerequisite text (display) |
| `text_req` | Requirement text |
| `text_descrip` | HTML description |
| `src` | Source book code (`PC1`, `PC2`, `CRB`, `APG`, `WoI`, `DA Remastered`, …) |
| `url` | Archives of Nethys link |

### 3.2 Specials — 71 tables

`specials_class_<class>[_<subgroup>]` — class features, subclass options, and
sub-selections. Examples: `specials_class_wizard`, `specials_class_wizard_theses`,
`specials_class_barbarian_instincts`, `specials_class_champion_causes`,
`specials_class_witch_patrons`, `specials_class_psychic_conscious`.

Two column signatures:

```
8 cols: name,level,actions,traits,text_req,text_descrip,src,url
7 cols: name,level,actions,traits,text_descrip,src,url
```

Plus standalone specials tables: `specials_actions`, `specials_universal`,
`specials_domains`, `specials_eidolon_abilities`, `specials_mythic_callings`,
`specials_weapon_groups`, `specials_automaton_enhancements`,
`specials_archetype_soulforger`.

### 3.3 Spells — 14 tables

| Table | Rows | Columns |
| --- | --- | --- |
| `spells` | 1379 | `name,type,level,traits,traditions,actions,cast,description,description2,var1,var2,var3,var4,shortDes,src,url,target,duration,range,save,area` |
| `spells_mythic` | — | same 21 columns |
| `spells_bloodlines` | — | `name,spellList,skill1,skill2,sCantrip,s1st..s9th,initialSpell,advancedSpell,greaterSpell,bloodMagic,description,src,url` |
| `spells_bloodlines_draconic` | — | `name,spellList,spell0,spell1,spell2,src,url` |
| `spells_apparitions` | — | `name,skill1,skill2,sCantrip,s1st..s9th,vesselSpell,description,src,url` |
| `spells_domain` | — | `name,spell,advancedSpell` |
| `spells_runes` | — | `name,level,traits,description,var1..var4,src` |

**Spell list tables** (which spells belong to which tradition):

| Table | Rows | Columns |
| --- | --- | --- |
| `spellist_arcane` | 981 | `name,level,outdated` |
| `spelllist_occult` | 828 | `name,level,outdated` |
| `spelllist_primal` | 734 | `name,level,outdated` |
| `spellist_divine` | 559 | `name,level,outdated` |
| `spellist_elemental` | 160 | `name,level,outdated` |
| `spelllist_elemental_universal` | 50 | `name,level` |
| `spellist_nonstandard` | 1 | `name,level` |

Note the inconsistent spelling: `spellist_*` (missing the second `l`) for arcane,
divine, elemental, nonstandard; `spelllist_*` for occult, primal, elemental_universal.
A clone should normalise this but must read the original names.

`outdated` marks spells that were renamed/removed in the Remaster; they are hidden
unless the character enables "Allow Outdated Spells".

### 3.4 Items — 13 tables

| Table | Columns |
| --- | --- |
| `items_all` | `type,name,level,traits,price,hands,bulk,usage,amount,action0,action0desc,action1,action1desc,description,src,url,skillname,skillbonus` |
| `items_weapons` | `name,level,price,weaponProficiency,ranged,damage,damageType,range,reload,bulk,hands,group,weaponTraits,description,src,url` |
| `items_weapons_magic` | `name,level,price,identity,traits,potency,striking,action0,action0desc,action1,action1desc,description,runes,src,url` |
| `items_armor` | `name,level,price,proficiency,acBonus,dexCap,checkPenalty,speedPenalty,strength,bulk,armorGroup,armorTraits,traits,description,src,url` |
| `items_armor_magic` | `name,level,price,identity,traits,potency,resilient,action0,action0desc,action1,action1desc,rune,description,src,url` |
| `items_shields` | `name,level,traits,actions,price,hands,bulk,usage,ac,speed,hardness,hp,action0,action0desc,description,src,url` |
| `items_fundamental_runes` | `name,level,traits,price,hands,bulk,contains,usage,amount,action0,action0desc,action1,action1desc,description,src,url` |
| `items_property_runes_weapons` | same 16 columns |
| `items_property_runes_armor` | same 16 columns |
| `items_property_runes_shields` | same 16 columns |
| `items_materials_weapons` | `name,level,traits,reducesBulk,base,description,src,url` |
| `items_materials_armor` | `name,level,traits,reducesBulk,strengthAdj,speed,ac,base,description,src,url` |
| `items_cursed` | `type,name,level,traits,price,hands,bulk,contains,usage,amount,action0,action0desc,action1,action1desc,description,src,url,skillname,skillbonus` |

`items_all.type` is a **numeric string** enum (observed values `0,1,2,3,4,5,6,7,9,10,13,14,18`).
`items_weapons.weaponProficiency` is also numeric. Verified by inspecting row contents
(not just the label array):

| Value | Category | Rows | Sample |
| --- | --- | --- | --- |
| `0` | Simple | 41 | Club, Dagger, Crossbow, Blowgun, Clan Dagger |
| `1` | Martial | 182 | Battle Axe, Bastard Sword, Bo Staff, Composite Longbow, Dogslicer |
| `2` | Advanced | 38 | Dwarven War Axe, Gnome Flickmace, Sawtooth Saber, Repeating Crossbow |
| `3` | Unarmed | 20 | Fist, Special Unarmed (1d4…1d10), stance attacks (Crane Wing, Tiger Claw, …) |

The display label array is
`["Simple Weapons","Martial Weapons","Advanced Weapons","Unarmed Attacks"]`, matching this
ordering (see [07-rules-engine.md](./07-rules-engine.md)). Note that `3` is *unarmed*, **not**
advanced — a common source of confusion because unarmed sits last in the UI list.

### 3.5 Ancestries, backgrounds, classes

| Table | Columns |
| --- | --- |
| `ancestries_new` | `id,name,traits,hp,size,speed,boosts,languages,other,bonus_lang,fluff,src,url` |
| `backgrounds` | `id,name,traits,boost_ref_1,boost_ref_2,boost_ref_3,numfreeboosts,freeFeatID,freeFeatDetail,lore,skill,skill2,description,category,src,url` |
| `classes_new` | `name,traits,description,keyAbility,hp,perception,saves,skills,attacks,defenses,classDC,spells,src,url` |

`backgrounds.boost_ref_*` are **numeric ability indices** (0=Str,1=Dex,2=Con,3=Int,4=Wis,5=Cha).

> **`size` is text in the data, ordinal in the export.** `ancestries_new.size` and
> `pets_animals.size` hold **words** (`"Medium"`, `"Small"`, `"Tiny"`, `"Large"`, and one
> row with the literal `"Choose the size appropriate to your animal: …"`). The
> character export's `size` field is an **integer ordinal** on a different scale
> (`0`=Tiny … `2`=Medium … `6`=Colossal). Do not feed one into the other — see
> [07-rules-engine.md](./07-rules-engine.md) §1.0 and
> [08-export-and-integrations.md](./08-export-and-integrations.md) §3.7.
`backgrounds.category` is numeric (0=General, 1=Regional, 2=Campaign, 3=Custom — matching
the dialog tabs).

### 3.6 Pets and companions — 6 tables

| Table | Columns |
| --- | --- |
| `pets_animals` | 36 cols: `name,traits,reqlevel,description,size,larger,melee1,melee1Action,melee1Dam,melee1Type,melee2,...,str,dex,con,intel,wis,cha,hp,skill,senses,speed,burrow,climb,swim,fly,special,support,advName,advAction,advTraits,advDesc,src,url` |
| `pets_eidolons` | `name,tradition,canbeSmall,traits,skills,type1,type2,array1,array2,ac1,dexcap1,ac2,dexcap2,senses,speed,ability1,ability2,ability3` |
| `pets_familiar_abilities` | `name,type,reqs,selectable,description,src` |
| `pets_familiar_specific` | `name,traits,description,req,special,src,url,g0,gd0,g1,gd1,...,g7,gd7` |
| `pets_animal_specializations` | `name,traits,reqAdv,description,src` |
| `pets_followers` | 27 cols (Commander followers): `id,name,a0Type,a0Name,a0Traits,a0Damage,a0DamageType,a1*,str,dex,con,int,wis,cha,hp,acItem,acDexCap,skills,lores,followerAbility,src,actionVeteran,actionExceptional` |
| `pet_animal_advancements` | `ref,name,traits,description,src,url` |

### 3.7 Other tables

| Table | Columns |
| --- | --- |
| `traits` | `name,type,description,url` |
| `conditions` | `condition,value,description` (`value` = `"TRUE"` if the condition takes a numeric value) |
| `languages` | `name,spoken_by,type` |
| `skill_actions` | `name,skill,trained,actions,traits,description,src,url` |
| `rituals` / `rituals_mythic` | `id,name,level,traits,description,src,url` |
| `copyright` | `name,type,title,full,short,group,version,remastered` |
| `other_arcane_schools` | `name,traits,description,initial,advanced,rank0..rank9,src,url` |
| `other_alchemist_research_fields_remastered` | `name,formulas,fieldBenefit,fieldVials,fieldDiscovery,advancedVials,greaterFieldDiscovery` |
| `other_thaumaturge_implements` | `name,description,initial,actionName,action,traits,actionDesc,adept,intensify,paragon,src` |
| `other_hellknight_orders` | `name,lesserName,lesserAction,lesserTraits,lesserDescription,greaterName,greaterAction,greaterTraits,greaterDescription,description,weapon,src,url` |

### 3.8 `sqlite_schema`

A CSV with header `type,name,tbl_name,rootpage,sql` and 412 rows: one `table` row per
real table plus one `index` row per `sqlite_autoindex_*`. The `sql` column holds the
original `CREATE TABLE` statement, which is the authoritative column list and order.

## 4. Source book codes (`src`)

Observed values include: `CRB`, `APG`, `GNG`, `TV`, `DA`, `DA Remastered`, `PC1`, `PC2`,
`WoI`, `IM`, `SOM`, `Gods and Magic`, `Battlezoo Bestiary`, `BZA: Dragons`.

Characters carry `listDisabledRulebooks` (books to hide) and `listOptInBooks` (books to
include beyond the default). The app filters every list by these.

## 5. Rebuilding the data locally

```bash
# 1. download
curl -o data_remastered80.txt https://pathbuilder2e-data.b-cdn.net/data_remastered80.txt

# 2. decode (node)
npm i lz-string
node -e "
const LZ=require('lz-string'), fs=require('fs');
fs.writeFileSync('data.json', LZ.decompressFromBase64(fs.readFileSync('data_remastered80.txt','utf8')));
"

# 3. load into SQLite (python)
python3 - <<'PY'
import json, csv, io, sqlite3
d = json.load(open('data.json'))
con = sqlite3.connect('pb.db'); cur = con.cursor()
for k, v in d.items():
    if k.startswith('sqlite_') or not v.strip(): continue
    rows = list(csv.reader(io.StringIO(v)))
    cols = [c.strip() for c in rows[0]]
    cur.execute('CREATE TABLE "%s" (%s)' % (k, ','.join('"%s" TEXT' % c for c in cols)))
    data = [r[:len(cols)] + ['']*(len(cols)-len(r)) for r in rows[1:] if r]
    cur.executemany('INSERT INTO "%s" VALUES (%s)' % (k, ','.join('?'*len(cols))), data)
con.commit()
PY
```

This produces a 245-table SQLite database that is a faithful local mirror of the
shipped rules data.
