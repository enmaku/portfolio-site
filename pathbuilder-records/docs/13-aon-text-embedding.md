# 13 - Embedding Archives of Nethys (AoN) rules text: legal and technical

Research for issue #478 (map #476). Probed 2026-11-21. Reports what is permitted and
feasible; it does not choose an architecture. Not legal advice. Builds on
[11-legal-and-licensing.md](./11-legal-and-licensing.md) section 9.

## 1. Short answer

- **Legally permitted, with conditions.** Paizo's rules text is licensed to everyone under the
  ORC License (post-Remaster books) or OGL 1.0a (older books). The text of feats, spells,
  items and actions is "Licensed Material" under the ORC's own definition. No
  non-commercial restriction, no permission needed from Paizo or AoN. Conditions: required
  notices, no implied endorsement, no Reserved Material (setting proper nouns, art,
  trademarks/logos), and the OGL's no-compatibility-claim clause for legacy content.
- **AoN's own licence does not transfer to us.** AoN operates under Paizo's *Community Use
  Policy* (CUP: free, non-commercial, unofficial). That is AoN's permission, not ours. We
  would rely on the ORC/OGL directly, with Paizo's books as the licensor.
- **Technically feasible only server-side or at build time.** The AoN Elasticsearch endpoint
  is anonymous and read-only but its CORS is an origin allowlist that rejects arbitrary
  origins. A browser on our production origin cannot call it (see 4.2). It has no published
  terms, documentation or stability promise.
- **Alternatives exist** (Foundry `pf2e` data repo, own pre-built index from AoN) with their
  own caveats (section 5).

## 2. Licence basis

### 2.1 ORC License (primary source: https://paizo.com/orclicense)

- **What is licensed.** "Licensed Material" includes "those expressions reasonably necessary
  to convey functional ideas and methods of operation of a game", explicitly listing
  "spells, skills, actions, reactions ... and equipment" under character creation and play, and
  "items and equipment", "conditions", "spell and ability effects" under gameplay systems
  (Definitions, I.e.(2)). Feat, spell, item and action rules text falls inside this.
- **What is not.** "Reserved Material" is "trademarks, trade dress, and creative expressions
  that are not essential to ... the ideas or methods of operation of a game system, including
  works of visual art ... settings, locations, worlds, plots ... including proper nouns and the
  adjectives, names, and titles derived from proper nouns" (I.h). Paizo's licences page
  restates this: no characters, locations, organizations, deities, events, art, maps, or
  logos (https://paizo.com/licenses, "ORC" section).
- **Grant.** Worldwide, royalty-free, non-sublicensable, non-exclusive, irrevocable, all
  media; terminable only for breach (II.a). Licensor cannot withdraw once the notice is
  published (IV). **No commercial-use restriction** appears in the text. Database rights
  held by the Licensor are covered (II.c).
- **Required notices (III)**, "in a reasonable manner based on the medium": (a) the ORC
  Notice ("This product is licensed under the ORC License located at the Library of Congress
  at TX 9-307-067 and available online at various locations. All warranties are disclaimed
  as set forth therein."); (b) an Attribution Notice naming each Licensor/creator of the
  Licensed Material used (the source books and authors); (c) a Reserved Material Notice
  listing our own Reserved Material, if any; (d) designation of anything we choose to
  license onward. III.e gives a sample notice.
- **Share-alike scope (II.b).** "Adapted Licensed Material" (our derivatives, only to the
  extent they would themselves be Licensed Material under I.e.(2)) is offered onward under
  the ORC. Reserved Material is excluded from that, so CritCrafter's code, UI, name and art
  are not captured, but any rules text we rewrite or extend is. We may not add extra terms or
  technical measures that restrict recipients' exercise of those rights.
- **No endorsement (II.d.i).** Must not assert or imply a connection with or sponsorship by
  the Licensor.
- **Trademarks.** ORC grants no trademark rights; Paizo says the Pathfinder logo or
  compatibility claims need the separate Compatibility License
  (https://paizo.com/licenses/compatibility). Nominative text references ("imports
  Pathbuilder exports", "Pathfinder 2e rules") are a trademark-law question already covered
  in doc 11 section 5, not an ORC question.

### 2.2 OGL 1.0a for pre-Remaster content

- Paizo's licences page: content released under the OGL stays under the OGL; it "can't"
  be relicensed as ORC (https://paizo.com/licenses). AoN still serves 2019-era Core
  Rulebook entries (spell `legacy_id` / `remaster_id` fields link old and new versions), and
  AoN's own Licenses page carries the OGL text and a Section 15 list
  (https://2e.aonprd.com/Licenses.aspx).
- Obligations if legacy text is embedded: reproduce the OGL and update Section 15 with the
  exact notices of each source (OGL sections 6, 8); **section 7 forbids indicating
  compatibility with any trademark** and using Product Identity without a separate
  agreement. Practical effect: keep legacy-OGL text out, or carry the OGL notices and avoid
  compatibility language near it. Preferring Remaster entries avoids this for most content.

### 2.3 Paizo Community Use Policy (https://paizo.com/licenses/communityuse)

- Applies to *Paizo Material* (logos, covers, blog text, some art, descriptive reference to
  names) for **free, non-commercial** projects: must be unofficial, reproduce Paizo notices,
  carry a specific notice text, include contact info, accept indemnification, and Paizo may
  revoke at any time (last updated 2024-08-22).
- It is not the instrument that licenses rules text; the ORC/OGL are. CUP is relevant to us
  only if we want Paizo art/logos (CUP package) in a free project. Not needed for text.

### 2.4 AoN's own terms and status

- AoN footer and Licenses page: "This website uses trademarks and/or copyrights owned by
  Paizo Inc., used under Paizo's Community Use Policy ... We are expressly prohibited from
  charging you to use or access this content." (https://2e.aonprd.com/Licenses.aspx).
- Paizo/AoN status update (https://www.archivesofnethys.com/movingforward.html, announced
  2026-07-24): the earlier commercial licence was replaced by a "much less formal" agreement
  under the CUP; art outside the CUP is being removed; AoN "will remain an official rules
  archive".
- **No AoN terms of service, API terms, robots.txt or rate-limit policy were found.**
  `2e.aonprd.com/robots.txt` returns 404; `Legal.aspx` returns 404; the only legal page is
  Licenses.aspx. The Contact page names the site owner as Rose-Winds LLC (Blake Davis).
- Consequence: what AoN adds beyond Paizo's text (curation, markup, cross-reference fields,
  database compilation) is not licensed to us by Paizo. Whether it carries separate rights
  is untested; no statement from AoN grants or denies reuse of its data. Reading Paizo's
  text from AoN is a practical convenience, not a licence source. This is the main legal
  grey area and the one to raise with counsel or with AoN directly.

### 2.5 Cross-checks with doc 11

- Doc 11 section 9 is consistent with this: mechanics are free, text needs ORC/OGL
  compliance, Product Identity/Reserved Material and logos are separate.
- One refinement: doc 11 flags names of feats/spells/classes as a possible PI issue. Under
  the ORC text, spells, actions, equipment and conditions are expressly Licensed Material
  as game-function expressions. Proper nouns that are setting elements (deities, places,
  named NPCs, faiths) are the Reserved ones. Each Paizo book also publishes its own
  Reserved Material notice; that list was not retrieved here and should be checked per
  source book before launch.

## 3. What in an AoN record is and is not safe

Observed record shape (`spell-1530`, Fireball): fields `name`, `category`, `level`, `trait`,
`source`, `source_raw` (book and page), `legacy_id`/`remaster_id`, `summary`, plain `text`,
and `markdown` (the body, with AoN tags such as `<actions>`, `<traits>`, links, and
`**Source**`/`**Traditions**` lines). Notes:

- The body (effect text, heightening) is rules text: Licensed Material.
- Deity lists on a spell (`deity`, `bloodline`, `domain` fields) are setting proper nouns:
  Reserved Material. Drop them or do not rely on them.
- Setting/lore categories (`deity`, `plane`, `article`, `creature` flavour, adventure
  content) and art are outside the grant. AoN removed non-CUP art from its pages; no image
  paths appear in the text fields sampled.
- Third-party sources can appear in the index; each record's `source` identifies the book,
  so a source allowlist (Paizo-published ORC/OGL books) is the control.
- Attribution input is available per record (`source_raw`), and source docs
  (`source-216` Player Core) give release date and product page, which supports building the
  III.b attribution notice. The index does not carry copyright lines or author credits; those
  come from the printed book notices.

## 4. AoN Elasticsearch endpoint (technical findings)

Endpoint: `https://elasticsearch.aonprd.com/aon/_search`. Used by SoT's
`cards/generate_cards.py` (POST JSON, `match_phrase` on `name`, `terms` on `category`,
`ids`). All probes below were run with a generic User-Agent and no project identifiers.

### 4.1 Access and behaviour

- Anonymous, read-only: `_search` works (POST or GET); `/` root and admin actions return a
  `security_exception` for `anonymous_user` (role `anon`).
- Document ids are stable-looking (`spell-1530`, `source-216`); the underlying index is
  dated (`aon-20261116-195046`) behind the `aon` alias, so the index is rebuilt in batches
  (monthly-ish with book releases). Ids appear stable across rebuilds but this is
  undocumented; AoN has changed ids on Remaster before (`legacy_id`/`remaster_id`).
- Counts: spell 2,798; feat 9,081; action 4,311; equipment 9,251; weapon 613; armor 75;
  class-feature 1,366; condition 98; trait 925 (index has 28,550 docs in those 10
  categories). Result window caps at 10,000 per query (`from+size`); scroll API not tested.
- Size: one full spell record is about 5 KB as JSON; `markdown` averages roughly 1.7 KB
  (spell), 0.8 KB (feat), 0.6 KB (action), 1.9 KB (equipment) in a 500-doc sample per
  category. Order of magnitude: tens of MB raw for all categories, including legacy
  duplicates. A pinned subset (just what is referenced by exports) is far smaller.
- Rate limits: 30 sequential requests in 7 s all returned 200; no `Retry-After` or
  rate-limit headers seen. No documented limit; nothing proves there is none.

### 4.2 CORS (decisive for client-side use)

Tested with an `Origin` header, POST and preflight OPTIONS:

| Origin | Result |
| --- | --- |
| none (curl, server-side) | 200 |
| `https://2e.aonprd.com` | 200, `access-control-allow-origin` echoed |
| `http://localhost:9000`, `:5173`, `:3000`, `:8080` | 200, origin echoed |
| `https://critcrafter.com`, `https://aonprd.com`, `https://example.org`, `https://pf2.easytool.es` | **403, empty body, no CORS headers** |
| OPTIONS preflight from `https://example.com` | 403 |

So the server accepts localhost on any port and AoN's own origin, and rejects others. A
deployed browser app cannot read it directly; a dev server on localhost can, which would
hide the problem until deploy. A server-side or build-time fetch (no `Origin`) works. Whether
a particular production hostname is allowlisted could only be known by asking AoN; the
allowlist looks deliberate, which also reads as a signal about intended use.

### 4.3 Stability and etiquette

- Undocumented, unauthenticated, no SLA, no versioning; field names and ids can change
  with the index. Treat as best-effort.
- Hammering a volunteer-run site is the foreseeable harm; a build-time snapshot with
  caching (as SoT already does under `cards/cache/aon/`) minimizes load. SoT sends a
  project-named User-Agent; any new tool should send a descriptive one with a contact route,
  and AoN could be asked (Discord channels listed on the Contact page) whether bulk use is
  welcome.

## 5. Alternatives

| Option | Licence position | Feasibility / caveats |
| --- | --- | --- |
| **Foundry `pf2e` system repo** (`foundryvtt/pf2e`) | README: code Apache-2.0; "game system information and mechanics" under OGL 1.0a; Paizo content "used with permission granted by the license agreement between Paizo Inc. and Foundry Gaming LLC"; "much of what this system includes is covered under Paizo's Community Use Policy". `static/licenses/` ships `ORCLicense.md` and `OpenGameLicense.md`. No per-pack licence stated. | Structured JSON packs (not fetched or sized here). The Foundry-Paizo agreement is private and may not extend to third-party reuse, so rely on ORC/OGL on the underlying text, not on Foundry's permission. Pack art is separate. |
| **Own pre-built index from AoN** | Same as section 2 plus AoN compilation caveat (2.4). | Build-time scrape of only the needed categories/sources; ship as static JSON. Needs periodic refresh; ids tied to AoN. Notices live in the product. |
| **Own pre-built index from Foundry packs** | ORC/OGL on text; Foundry agreement not relied on. | Avoids AoN's endpoint and CORS; schema differs from AoN. |
| **Link out to AoN** (no embedding) | No licence needed to link. | Not text embedding; listed only because it needs no rights. |
| **Paizo's own PDFs/PRD** | ORC/OGL on text. | No public machine-readable feed found; manual. |

Not verified: whether Paizo publishes an official open data feed for PF2e; Foundry pack
schema, size and completeness for items/actions; Archives of Nethys' position on bulk data
reuse (could not be found in any primary source).

## 6. Open items before relying on this

1. Per-book Reserved Material notices (Player Core, GM Core, Treasure Vault, etc.) were not
   retrieved; confirm which named items are Reserved before shipping.
2. Ask AoN (Discord channels on the Contact page) about bulk use and the CORS allowlist, or
   treat the endpoint as unsupported.
3. Confirm whether CritCrafter is free/non-commercial. ORC does not care; CUP (needed only
   for Paizo art/logos) and AoN's own status do.
4. Counsel review on the ORC share-alike boundary (II.b) for any rewritten rules text and on
   the AoN compilation/database layer.

## 7. Sources

- ORC License text: https://paizo.com/orclicense
- Paizo licences overview: https://paizo.com/licenses
- Community Use Policy: https://paizo.com/licenses/communityuse
- Compatibility License: https://paizo.com/licenses/compatibility
- AoN Licenses page: https://2e.aonprd.com/Licenses.aspx
- AoN/Paizo partnership update: https://www.archivesofnethys.com/movingforward.html
- AoN Contact page: https://2e.aonprd.com/ContactUs.aspx
- AoN Elasticsearch endpoint: https://elasticsearch.aonprd.com/aon/_search (direct probes)
- Foundry pf2e: https://github.com/foundryvtt/pf2e (README, `static/licenses/`)
- Sibling script: `~/code/strength-of-thousands/cards/generate_cards.py`
