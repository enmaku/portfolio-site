# 01 — Architecture

## 1. Hosting and boot sequence

### 1.1 Static shell

`app.html` is a small static page (~13.8 KB) that contains:

* All the **static DOM scaffolding** the app will fill in later:
  `#mySidenav`, `.dice-tray`, `.top-bar`, `#main-container`, `#root` (modal host),
  `#snackbar`, `#google-login`, `#ring-holder` (loading spinner).
* Stylesheet links to the CDN (`pathbuilder-min.css`, `pathbuilder-lm-minv2.css`,
  `pathbuilder-starbuilder-dmv1.css`, `global.css`, `toggle.css`, `ldsring.css`,
  `nouislider.min.css`, plus Inter from `rsms.me`).
* Third-party scripts: Stripe, PayPal SDK, Google API client, Google Identity
  Services, `jwt.js`, `longpress.js`, `wNumb`, `noUiSlider`, `dicecode-min2.js`,
  PapaParse (CSV parser), Cloudflare beacon.
* An inline script that reads `localStorage.colorMode` and sets
  `html.light` / `html.starbuilderdark` / `html.starbuilderlight`.
* An inline script that defines `loadPathbuilder(version)` and then:

```js
fetch("/version.json", { cache: "no-store" })
  .then(r => r.json())
  .then(version => loadPathbuilder(version))
  .catch(() => { /* fall back to localStorage.pathbuilderLastVersion */ });
```

`loadPathbuilder` validates `version.jsVersion` against `/^[a-zA-Z0-9.]+$/`, stores the
version object on `window.pathbuilderVersion`, and injects:

```html
<script src="https://pathbuilder2e-data.b-cdn.net/Pathbuilder2eWebRemastered<jsVersion>.js">
```

So **the app version is a URL segment**, and the shell can hot-swap versions without
changing `app.html`. `version.json` is served from the origin (Cloudflare-protected
against non-browser clients) and looks like:

```json
{ "displayVersion": "112", "versionName": "Feylines", "jsVersion": "112.0" }
```

### 1.2 The bundle

`Pathbuilder2eWebRemastered112.0.js` is a **webpack UMD bundle** with 6 modules:

```
36: (i, t) => { ... }   // Kotlin/JS stdlib + runtime (the bulk)
352: (i, t) => { ... }
430: (i, t) => { ... }
441: (i, t) => { ... }
539: (i, t) => { ... }
718: (i, t) => { ... }
```

The UMD wrapper assigns the export to `globalThis.web`:

```js
!function(i, t) {
  "object" == typeof exports && "object" == typeof module ? module.exports = t()
  : "function" == typeof define && define.amd ? define([], t)
  : "object" == typeof exports ? exports.web = t()
  : i.web = t()
}(globalThis, () => { ... });
```

`window.web` is an object with **no enumerable own keys** — the app's entry point is
invoked internally, not exposed. There is no public API surface to hook; a clone must
either reimplement the UI or drive the DOM.

### 1.3 Language and toolchain

* **Kotlin/JS** (Kotlin Multiplatform, IR backend). Evidence:
  * `kotlin` appears 169 times in the bundle.
  * Kotlin collection classes (`pi()` = HashMap, `ui()` = LinkedHashSet, `mh()` =
    ArrayList, `uh()` = LinkedHashMap, `bi()` = listOf, `Be()` = setOf, `yh()` =
    mapOf, `bh()` = Pair).
  * Kotlin `$serializer` / `mt()` / `dm()` / `em()` = kotlinx.serialization
    `SerialDescriptor` / `element()` / `beginStructure()` / `endStructure()`.
  * `_h(Class, "Name")` calls register Kotlin class metadata (514 named classes).
  * `sh(Class).method = function` assigns prototype methods.
  * `_i(Class).method = function` assigns static/companion methods.
  * `oi` = `Unit`, `oh` = `null`, `wi()` = `null` cast helper, `fh()` = `null`.
* **kotlinx.serialization** for the character JSON (see `$serializer` registrations).
* **PapaParse** for CSV parsing of the data tables.
* **noUiSlider** for range sliders (bulk, level, etc.).
* **dicecode-min2.js** for the dice roller.

### 1.4 Module/class inventory

The bundle registers **514 named Kotlin classes**. The most important groups:

| Group | Count | Examples |
| --- | --- | --- |
| `Ancestry*` | 122 | `AncestryHuman`, `AncestryDwarf`, `AncestryCustom` |
| `Class*` | 59 | `ClassWizard`, `ClassWizardRemastered`, `ClassFighter` |
| `Caster*` | 32 | `CasterWizard`, `CasterBard`, `CasterCleric`, `CasterSummoner` |
| `Backend*` | 16 | `BackendExportSpells`, `BackendExportFeats` |
| `Manager*` | 14 | `ManagerSpells`, `ManagerFeats`, `ManagerClasses`, `ManagerEquipment` |
| `Feat*` | 13 | `FeatInformation`, `FeatChoice`, `FeatPrerequisite` |
| `Custom*` | 11 | `CustomPack`, `CustomSpell`, `CustomBuff` |
| `Archetype*` | 10 | `ArchetypeCaster`, `ArchetypeCasterWitch` |
| `Follower*` | 10 | `FollowerAdept`, `FollowerMedic` (Commander followers) |
| `Export*` | 8 | `ExportStatBlock`, `ExportStatBlockEidolon` |
| `Animal*` / `Familiar*` | 7 each | `AnimalCompanionInformation`, `FamiliarAbility` |
| `Player*` | 7 | `PlayerSpell`, `PlayerWeapon`, `PlayerArmor`, `PlayerEquipment` |
| `Character*` | 5 | `CharacterBuild`, `CharacterData`, `CharacterJson` |
| `Spell*` | 5 | `SpellCaster`, `SpellCasterObject`, `SpellInformation` |

The full list is in `probe/assets/class-names.txt` (regenerate per
[`probe/README.md`](../probe/README.md); not included in this repo).

### 1.5 Manager pattern

Every data domain has a `Manager*` class extending `ManagerTemplate` (`jA`):

```
ManagerAncestry, ManagerArmor, ManagerBackgrounds, ManagerClasses, ManagerCopyright,
ManagerEquipment, ManagerExportAbstract, ManagerFeats, ManagerPets, ManagerProficiencies,
ManagerSpecials, ManagerSpells, ManagerWeapons
```

Each manager owns the in-memory maps for its domain and exposes lookup methods. The
`ManagerSpells` (`yA`) is the most complex and is documented in
[04-spell-system.md](./04-spell-system.md).

## 2. Data loading

`_i(R_).bik(i, t, n, e)` is the data downloader:

```js
var h = "https://pathbuilder2e-data.b-cdn.net/" + t + ".txt";
var u = new XMLHttpRequest;
u.open("GET", h, !0);
u.setRequestHeader("Content-Type", "text/plain");
u.onreadystatechange = function() {
  if (4 == u.readyState)
    if (200 == u.status) {
      a.bi0_1.hic("Processing Data");
      a.bi0_1.chx_1.jij(u.response, t);   // cache raw text in IndexedDB "data" store
      a.kij(u.response, _, t, o, c);      // decode + parse
    } else if (!navigator.onLine) { ... }
};
u.send();
```

* Retries up to 5 times (`if (i > 5) return new bu("Alert!", "Unable to get data from the server...")`).
* Raw text is cached in IndexedDB store `data` under keys `data137` and
  `data_remastered80`, so subsequent boots are offline-capable.
* `kij` decodes with `B.eik(...)` (LZ-string) then `JSON.parse`, then iterates the
  top-level keys and dispatches each CSV string to the right manager.

### 2.1 Version check

`_i(R_).fij` runs every 30 minutes (`setInterval(..., 18e5)`) and on
`visibilitychange`. It re-fetches `/version.json` and, if `jsVersion` differs from
`window.pathbuilderVersion.jsVersion`, shows a modal offering to reload.

## 3. Storage

### 3.1 IndexedDB — `pathbuilder2e_db` (version 3)

| Store | Key | Value | Purpose |
| --- | --- | --- | --- |
| `saves` | character `webID` (UUID) | JSON **string** of the character | Local character saves |
| `saveIDs` | character `webID` | JSON string of `{characterName, classLevel, timestamp, webID, isStarbuilderCharacter}` | List metadata for the load dialog |
| `data` | `data137`, `data_remastered80` | raw LZ-string text | Cached rules data |
| `customFiles` | UUID | custom pack JSON | User custom content |
| `customBGs` | UUID | custom background | User custom backgrounds |
| `folders` | UUID | folder record | Save organisation |
| `portraits` | UUID | image blob | Character portraits |

Note the `saves` value is a **string**, not an object — the app `JSON.parse`s it on read.

### 3.2 localStorage keys

Observed keys (all prefixed `pref` unless noted):

```
prefAutoHeighten, prefClientEmail, permissionStorage, pdfObject,
pathbuilderLastVersion, prefLastExportedDatabase, prefLastLocalGoogle,
prefPathbuilderEncountersGameID, prefStopDatabaseReminders, prefAccount,
prefJsonID, spellbook, firebase:host:pathbuilder-encounters-default-rtdb.firebaseio.com,
prefHasUsedGMMode, prefUserID, __paypal_storage__, prefShownHelp,
prefLastGearNewSub, prefLastGearNew, prefUserName, prefNoGMModeDialog,
prefLastCharacterModeStarbuilder, prefPreloadLighmode, prefAlphaOrder,
colorMode, prefLastCharacterID, prefLastCampaign
```

`spellbook` and `pdfObject` are **handoff payloads**: the app serialises a document
into localStorage and then `window.open("spellbook.html")` / `pdf.html` /
`statblock.html` / `export.html`, which read it back.

### 3.3 sessionStorage

`gmModeID` — set when launching GM Mode, cleared on `beforeunload`.

## 4. Third-party services

| Service | Use |
| --- | --- |
| Google Identity Services | Login (`client_id 405471180910-...apps.googleusercontent.com`) |
| Google Drive API | Cloud character saves |
| Firebase Realtime DB | `pathbuilder-encounters-default-rtdb.firebaseio.com` — GM Mode / live play |
| Stripe + PayPal | One-time $6.99 unlock |
| Cloudflare | CDN + bot protection on `pathbuilder2e.com` |
| `pathbuilder2e-data.b-cdn.net` | All static assets and data files (Bunny CDN) |

## 5. Companion pages

The app opens separate HTML pages for heavy output, passing data via localStorage:

| Page | Payload key | Purpose |
| --- | --- | --- |
| `pdf.html` | `pdfObject` | Legacy character sheet PDF |
| `pdfremastered.html` | `pdfObject` | Remastered character sheet PDF |
| `pdfstarbuilder.html` | `pdfObject` | Starfinder sheet PDF |
| `statblock.html` | `pdfObject` | Stat block PDF |
| `spellbook.html` | `spellbook` | Printable spellbook |
| `export.html` | `spellbook` | Export view |
| `json.php?id=<n>` | — | Server-side JSON viewer (returns the export JSON) |

## 6. Starfinder ("Starbuilder") mode

The same bundle serves a second game system. `window.starbuilder*` flags and the
`pathbuilder-starbuilder-dmv1.css` stylesheet switch the UI. Character objects carry
`starbuilderCharacter: true` and `isStarbuilderCharacter` in `saveIDs`. A clone can
ignore this mode initially but should keep the `starbuilderCharacter` field for
round-tripping.
