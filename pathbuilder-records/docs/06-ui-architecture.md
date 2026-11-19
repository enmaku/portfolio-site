# 06 — UI Architecture

Pathbuilder builds its entire interface imperatively. There is no virtual DOM, no
framework, no templating. Every element is created with `document.createElement`
(wrapped in helpers) and inserted with `appendChild`. Understanding the DOM contract
is therefore the fastest route to a faithful clone.

> **Screenshots.** Every screen and dialog described below has a captured image in
> [`img/`](./img/). Filenames are numbered by area (`10-` main tabs, `20-` sidebar,
> `3x/4x/5x` sidebar dialogs, `6x-9x` build-column and top-bar dialogs). Captures were
> taken from the live app at 1920×878.
>
> **Provenance caveat.** The loaded character was a **Fighter** ("Unknown Adventurer —
> Fighter 1"), not the Dwarf Cleric whose build walkthrough appears in
> [03-character-model.md](./03-character-model.md) and
> [04-spell-system.md](./04-spell-system.md). Earlier build-switching during capture
> left a different character loaded, and the captures were not re-taken. The
> **structure** of every screen and dialog shown is correct and generic; only the
> character-specific *contents* (feat names, spell lists, class features) reflect the
> Fighter. Treat the screenshots as layout references, not as Cleric references.

## 1. The static shell (`app.html`)

```
<body>
  <div id="mySidenav" class="sidenav">          ← slide-out menu
  <div class="dice-tray">                        ← right-hand dice panel
  <div class="top-bar">                          ← menu / builds / level / HP
  <div id="main-container">                      ← everything else
      <div id="divBuild" class="main-column-left">   ← the build column
      <div class="main-column-right">               ← the tabbed panel
  </div>
  <div id="backdrop">                          ← sidenav scrim
  <div id="dice-backdrop">                     ← dice scrim
  <div id="snackbar">                          ← transient toasts
  <div id="ring-holder">                       ← loading spinner (ldsring.css)
  <div id="root">                              ← modal host
  <div id="google-login">
</body>
```

![Full application view](./img/00-full-app.png)

*The complete app: build column on the left, tabbed panel on the right, sidebar
collapsed. The eight main tabs, the cog buttons, and the money/bulk strip are all
visible.*

![Start dialog](./img/01-start-dialog.png)

*The pre-character start screen (`#root-no_character`): Pathbuilder/Starbuilder mode
buttons, New Character, Load Character, "Load Most Recent Character", GM Mode, and the
version footer. Note this is a `.modal` but not a `Ou` dialog — no `.dialog-title`, no
`.modal-button`.*

Element ids that code queries by name (`document.getElementById`) are part of the
public contract and must exist before boot:

```
mySidenav, backdrop, dice-backdrop, dice-switch, main-container, divBuild,
divBuildLevels, divTopButtons, tabbed-area, beta-text, mode-toggle-holder, snackbar
```

### 1.1 Class stylesheets

| File | Purpose |
| --- | --- |
| `pathbuilder-min.css` | The main theme. Defines every `div-button`, `rounded-rectangle`, `grid-container`, `listview-*`, `section-menu`, `switch`, etc. |
| `pathbuilder-lm-minv2.css` | Layout-modifier classes (`lm-section-menu-background`) |
| `pathbuilder-starbuilder-dmv1.css` | Starfinder skin |
| `global.css` | Reset/base typography, Inter font |
| `toggle.css` | The light/dark switch |
| `ldsring.css` | Loading spinner |
| `nouislider.min.css` | Sliders (bulk, level, money) |

Light mode is `html.light` (set from `localStorage.colorMode`). Starfinder dark is
`html.starbuilderdark`, light `html.starbuilderlight`.

## 2. Top-level layout

```
main-container[display:flex]
├── divBuild.main-column-left
│   ├── divTopButtons.rounded-rectangle.build-section
│   │   └── .div-button (Ancestry | Background | Class) ×3
│   └── divBuildLevels
│       └── .build-section (×20, one per level)
│           └── aside
│               ├── .centered-div-holder > .subtitle.subtitle-build#id_header  ("Level N")
│               └── .rounded-rectangle
│                   ├── .centered-flex            ← the cog buttons for this level
│                   │   └── div
│                   │       └── .div-button.cogButton  (×n)
│                   │           ├── .centred-parent
│                   │           │   ├── img.centred (icon_cog or icon_cog_tick)
│                   │           │   └── .cogText.centred.button-text   ("3" = remaining)
│                   │           └── .centered-tiny.centered-flex.button-text  ("Skill Training")
│                   ├── .hidden  / .grey-text.hidden     (spacers)
│                   ├── div                              ← feat/special rows (#id_parent_feats)
│                   ├── div#id_parent_options
│                   ├── div#id_parent_free
│                   └── ...
└── main-column-right
    └── #tabbed-area.rounded-rectangle.tabbed-area
        ├── .tabbed-area-menu
        │   └── .section-menu ×8   (Weapons, Defense, Gear, Spells, Pets, Details, Feats, Actions)
        ├── .lm-section-menu-background.submenu          ← class-specific submenu row 1
        ├── .lm-section-menu-background.submenu          ← class-specific submenu row 2
        └── .tabbed-area-display-holder
            └── .tabbed-area-display
```

### 2.1 The cog-button widget (`VT`)

This is the single most repeated control in the app — every "thing you must choose"
at a level is one. Structure:

```html
<div class="div-button small-margin-right-bottom padding5 cogButton">
  <div class="centred-parent">
    <img class="centred" src="…/icon_cog.png?v=dm-1">        <!-- or icon_cog_tick.png -->
    <div class="cogText centred button-text hidden">3</div>  <!-- remaining count -->
  </div>
  <div class="centered-tiny centered-flex button-text">Skill Training</div>
</div>
```

* The icon flips to `icon_cog_tick.png` when the choice is complete.
* `.cogText` holds the **remaining** count; it is `.hidden` when zero/irrelevant.
  `gj5(n)` sets it, `fj5(label)` sets the title text.
* Some cog buttons are wrapped in a bare `<span>` (the "Deity Skill" one is) —
  a reminder that wrappers are inconsistent.
* Finished dialogs: the footer button says **"Finished"**; the base dialog also has
  `Cancel` and often a third action button (`Lores`, `PRD`, `Clear`, `Accept`).

### 2.2 Click-handling conventions

Three patterns appear everywhere; a clone should pick one, but must be aware of all
three when automating the real app:

1. **Direct listener on the built element** —
   `el.addEventListener("click", fn)`. Most buttons.
2. **Content delegation** — `container.addEventListener("click", e => { if
   (e.target.classList.contains("section-menu")) … })`. Used by the tab bar and the
   sidenav.
3. **Reverse map lookup** — the app stores `map[element] = value` and resolves the
   clicked element by walking `target.parentElement` upward until a key is found.
   Used by `Cv`/`Sv`/`Ev` (skill dialogs) and `Au`/`ju` (listviews).

Pattern 3 is why synthetic clicks can be fiddly: the map is keyed by a *specific*
element, so the click must land on that element or one of its descendants — and
`document.elementFromPoint` must resolve into the right subtree. When driving the app
programmatically, prefer `element.click()` on the mapped element itself, or click the
**centre** of `.listview-topdiv`.

## 3. The main tabs

Eight fixed tabs, built in `Nh()` from
`["Weapons","Defense","Gear","Spells","Pets","Details","Feats","Actions"]`:

| Tab | Contents |
| --- | --- |
| **Weapons** | Weapon list with attack/damage math, strike rows, runes, materials, "Add Weapon" |
| **Defense** | Armour, shield, AC breakdown, saves, resistances/weaknesses/immunities |
| **Gear** | Money strip, bulk meter, Add Gear / Add Container / Add Formula / Print, main inventory tree, formulae |
| **Spells** | One column per caster (see [04-spell-system.md](./04-spell-system.md)) |
| **Pets** | Animal companions, familiars, eidolons, followers |
| **Details** | Basics (name, ancestry, background, class, deity, alignment, age, gender), languages, senses, notes |
| **Feats** | Every feat grouped by slot, plus granted feats |
| **Actions** | All granted actions/activities (from feats, items, class features), with action icons |

![Weapons tab](./img/10-tab-weapons.png)

*Weapons tab.*

![Defense tab](./img/10-tab-defense.png)

*Defense tab — armour, shield, AC breakdown, saves.*

![Gear tab](./img/10-tab-gear.png)

*Gear tab — money strip, bulk meter, Add Gear / Add Container / Add Formula / Print,
main inventory.*

![Spells tab](./img/10-tab-spells.png)

*Spells tab — one column per caster with per-rank sections.*

![Pets tab](./img/10-tab-pets.png)

*Pets tab.*

![Details tab](./img/10-tab-details.png)

*Details tab.*

![Feats tab](./img/10-tab-feats.png)

*Feats tab — every slot and its selected feat.*

![Actions tab](./img/10-tab-actions.png)

*Actions tab.*

![Defense tab detail](./img/11-tab-defense-detail.png)

*Defense tab, closer view of the derived-stat rows.*

### 3.1 Submenus

`ui5_1` and `vi5_1` are two extra `.submenu` rows inserted *after* the main
`.tabbed-area-menu`. They are populated per class, e.g. Wizard contributes
`Wizard | Rituals`. If a class provides no submenu the row stays
`display:none` with class `.invisible`. Both rows share the `.section-menu` item
class and the same delegation handler, so a submenu item is visually and
behaviourally identical to a main tab.

### 3.2 Gear tab anatomy

```html
.div-tabbed-line
  .table-money-holder > .grid-container.table-money
     .div-button.button-money  ×4   (Platinum, Gold, Silver, Copper)
        img  +  .small-text.grey-text label  +  span.button-selection amount
  .div-bulk-container
     .div-bulk  >  span "Total Bulk 0"  +  span.grey-text "Unencumbered (Enc: 7; Max: 12)"
  .table-money-holder > .grid-container.table-gear-buttons
     .div-button-simple.button-simple ×4  (Add Gear, Add Container, Add Formula, Print)
.equipment-container#MAIN INVENTORY
  .subtitle "Main Inventory"
  .grid-container
.layout-tabbed-line.hidden   (Formulae)
```

The `id="MAIN INVENTORY"` (with a space!) is a lookup key — a clone should normalise
this but must know the original uses a space in an id.

![Add Gear dialog](./img/81-add-gear.png)

*`Add Gear` — a listview dialog with the Gear / Consumables / Magic Items / All /
Custom facet tabs and Close / PRD / Custom footer.*

![Add Container dialog](./img/82-add-container.png)

*`Container Options` — the small form dialog used to create a container.*

![Add Weapon dialog](./img/80-add-weapon.png)

*`Add Weapon` — Simple / Martial / Advanced / Unarmed / Proficient facets, with a
Buy / Give / Cancel / PRD / Custom footer. "Buy" spends gold, "Give" adds for free.*

## 4. Sidebar (`#mySidenav`)

A single scrolling column of `.menu-group-header` + `.menu-group > .sidenav-link`
items, plus two mode buttons at the top and a dark/light switch.

```
Signin      : sidenav-upgrade, sidenav-logout
Character   : sidenav-remaster-convert, sidenav-options, sidenav-new,
              sidenav-save, sidenav-load
Connect     : sidenav-connect, sidenav-gm-mode
Export      : sidenav-pdf, sidenav-statblock, sidenav-json, sidenav-share
Data        : sidenav-export, sidenav-campaign, sidenav-feat-browser,
              sidenav-remaster-info
Custom      : sidenav-custom-pack, sidenav-custom-ability,
              sidenav-custom-feat-choice, sidenav-custom-skill-increase
Help        : sidenav-help, sidenav-ogl, sidenav-patch, sidenav-error
```

Plus non-link elements:

* `#mode-controls` — Pathbuilder 2e / Starbuilder mode buttons (images, not text)
* `#sidenav-remaster-toggle` — plain text `Remaster: On|Off` (display only; the
  actual toggle lives in Character Options)
* `#mode-toggle-holder` — the dark/light switch (`input#togBtn` + `.slider.round`)
* `#para-books` — small warning text about new books

Behaviour:

* Opens via the hamburger (`#menu` in the top bar) which sets `width` on
  `#mySidenav` and shows `#backdrop`; closes on backdrop click or a second hamburger
  click.
* `aria-hidden` flips with the open state.
* Links are `.sidenav-link` divs (not anchors) with a click listener each.
* `#sidenav-remaster-convert` only appears for legacy (non-Remaster) characters.

![Sidebar open](./img/20-sidebar-open.png)

*The sidebar (`#mySidenav`) with the backdrop dimming the app. Mode buttons at top, then
Signin / Character / Connect / Export / Data / Custom / Help groups, the Remaster label,
and the dark/light switch.*

## 5. Top bar

```html
<div class="top-bar">
  <div class="menu-bar">
    <div id="menu"><img class="hamburger"><div class="menu-title button-text">Menu</div></div>
    <div id="active-builds">
      <div class="active-build-section active-build-section-active|inactive">
        <div class="button-active-build button-text">X</div>
        <div class="button-active-build button-text">Name - Class Level</div>
        <div class="dot-holder"><img class="dot hidden"></div>
      </div> …
    </div>
  </div>
  … (level / XP / name / rest / conditions / buffs row)
</div>
```

The second row of the top bar holds the **level selector**, the **XP bar**, the
**character name** field, **Rest**, **Add Condition**, **Add Custom Buff**, and the
**dice-tray switch** (`#dice-switch`). Multiple characters can be open at once —
`#active-builds` is a list, the active one carries `active-build-section-active`.

There is also a **Hide Plan / Show Plan** toggle that collapses the whole build column,
and a **Rest** button that resets daily resources.

![Set Character Level](./img/84-set-level.png)

*`Set Character Level`.*

![Set XP](./img/85-set-xp.png)

*`Set XP`.*

![Character Name](./img/86-character-name.png)

*`Character Name`.*

![Rest](./img/88-rest.png)

*`Rest` — resets spell slots, focus points, and HP.*

![Apply Condition](./img/89-add-condition.png)

*`Apply Condition` — every condition from the `conditions` table, with a value box for
those whose `value` column is `TRUE`.*

![Custom Buffs](./img/90-add-custom-buff.png)

*`Custom Buffs` — the list of user-defined buffs plus a Create button.*

## 6. Dialogs (modals)

Everything modal is created by a subclass of `Ou`. Structure:

```html
<div class="modal">                    ← appended to <body>, display:flex when open
  <div class="modal-content [modal-content-listview]">
    <div class="dialog-top-bar">
      <div class="dialog-title">Select Skill</div>
      <img class="button-filter">      ← optional facet toggle
      <div class="dialog-top-bar-right">…</div>
    </div>
    <div class="content-listview">   (listview dialogs only)
      <div class="div-listview-scroller noSelect"> …rows… </div>
      <div class="div-listview-info">   ← right-hand detail pane
    </div>
    <div class="modal-buttons">        ← footer
      <div class="modal-button">Finished</div>
      <div class="modal-button">Lores</div>
    </div>
  </div>
</div>
```

Base-class API (`Ou`):

| Method | Effect |
| --- | --- |
| `djb()` | set width 40em |
| `rj7()` | set width 30em |
| `pj9(el)` | append a footer button |
| `ejb(el)` | append a 12em-wide footer button |
| `tj9(el, idx)` | insert footer button at position |
| `vj9()` | remove the "clear" ✕ and rename the primary button to **Finished** |
| `uj9()` / `fjb()` | remove individual footer buttons |
| `ci5()` | show (`display:flex`) |
| `sj7()` | remove from `document.body` |
| `wj9(tabs, idx)` | build the tabbed filter row + filter icon |
| `rj9` / `sj9` | append a control to the header |

Important consequences:

* A dialog is **appended to `body`**, not nested in `#root` in practice — the same
  modal is re-created each time it opens.
* When several are stacked, `.modal:last-of-type` is the topmost.
* Alerts ("Alert!", "Information") are a different, simpler class but share
  `.modal`.
* The primary button label is the only reliable signal of "this dialog is finished":
  `Finished` vs `Accept`/`Ok`/`Cancel`.

## 7. Listview widget (`Au`)

Used by every chooser: feats, spells, skills, equipment, languages, conditions.

```
.modal-content.modal-content-listview
  .div-topbar_holder
    .tabbed-area-menu.tabbed-area-menu-sb   ← filter tabs
    img.button-filter                        ← facet panel toggle
  .dialog-top-bar > .dialog-title
  .content-listview
    .div-listview-scroller.noSelect
      .listview-item
        .top-div.listview-topdiv
          .listview-title                 ← the name
          img.action-icon
          div[style=flex:1]
          .listview-item-level.item-level-box   ← the level badge
        .listview-detail.hidden
          .trait.trait-common …            ← trait chips (clickable filters)
          div  description html
          .copyright  ("PC1")
    .div-listview-info                     ← right pane, mirrors the selected item
```

Interaction rules:

* Clicking a row toggles `.listview-detail` open/closed *and* selects it.
* `.listview-topdiv-selected` + `.listview-title-selected` mark the current row.
* The row click handler is installed only when the constructing code passes `true` to
  `Su(clickable)`; non-clickable rows (e.g. inside an info pane) do nothing.
* Trait chips check `classList.contains("trait")` and stop the toggle, so clicking a
  trait does not collapse the row.
* Keyboard: `onKeyUp`/`onKeyDown` handlers on the search box implement arrow-key
  navigation and Enter-to-accept.

## 8. Dice tray

Right-hand slide-out panel, opened by clicking `#dice-switch`:

```html
<div class="dice-tray" style="right: -360px" aria-hidden="true"> … </div>
<div id="dice-backdrop" class="hidden"> … </div>
```

* Opening: `right: 0`, `aria-hidden: false`, backdrop shown.
* Closing: any click on the backdrop.
* Contains the dice roller (dicecode-min2.js), a d20 quick-roll, and a modifier field.
* `#dice-switch` is *removed from `.hidden`* during boot, so it is invisible until
  the app is ready.

![Dice tray](./img/91-dice-tray.png)

*The dice tray slid open (`.dice-tray` at `right: 0`), with Reset, the d4–d20 quick
buttons, and the dicecode roller below.*

## 9. Snackbar and alerts

* `#snackbar` — a transient toast at the bottom; used for non-blocking messages.
* Modal alerts (`Bu(...)` → `new SomeAlert(...)`) — blocking, with a single button.
  They can stack on top of dialogs; target the last `.modal`.
* The loading state is `#ring-holder` with `.lds-ring`.

## 10. Options dialog (Character Options)

Reached from `sidenav-options`. A tabbed dialog with these facets:

| Tab | Controls |
| --- | --- |
| Books | Checkbox per source book (`listDisabledRulebooks`) plus opt-in books (`listOptInBooks`) |
| Variants | Free Archetype, Automatic Bonus Progression, Proficiency Without Level, Ancestry Paragon, Gradual Ability Boost, Dual Class, Stamina, Skill Paragon, Mythic |
| Spells | Allow outdated spells, auto-heighten, updated spells |
| Feats | Show dedication feats, show aftermath feats, show mythic |
| Ability | Override ability scores, optional flaw, free ability selection |
| Misc | Autosave, level warnings, spellbook confirmation, adventurer's kit, multiple purchase |
| Remaster | Remaster on/off, Remaster PC2 |

Each checkbox writes a boolean straight onto the character object and triggers a full
re-render.

## 11. Rendering model

There is no diffing. The pattern is:

```
mutate character field
  → call a manager method that recomputes derived state
  → call the affected view's render method, which clears innerHTML and rebuilds
```

Consequences for a clone:

* **Rebuild cost is real.** The build column can hold ~20 levels × ~10 rows; the app
  rebuilds only the touched level, not the whole column (`cj3(level)`, `mix(level)`).
* **Scroll position is managed manually** — dialogs call `scrollIntoView()` on the
  selected row and then subtract 10px from the parent's `scrollTop`.
* **Focus is re-applied** after rebuilds via a `MutationObserver` that calls
  `focus()` on the search box.
* Every interactive element is a `div`/`span`, not a `button`/`a` — there is almost
  no native keyboard accessibility. A clone should use real controls, but must not
  assume the original does.

## 12. Screen & dialog inventory (with captures)

### 12.1 Sidebar dialogs

![Options](./img/30-options.png)

*`Options` — Character Options: rulebooks, variant rules, spell/feat visibility,
ability overrides, autosave. Everything here writes directly onto the character object
and triggers a full re-render.*

![New Character](./img/31-new-character.png)

*`New Pathbuilder 2e Character` — the entry point (Get Started / Core Only).*

![Save](./img/32-save.png)

*`Save: <name>` — local save with folder choice.*

![Open Character](./img/33-open-character.png)

*`Load Character` — the local save list, with Accept / Cancel / PRD / Delete / Move.*

![GM Connection](./img/34-connect-gm.png)

*`GM Connection` — connect to a GM's Firebase session.*

![GM Mode](./img/35-gm-mode.png)

*GM Mode — a separate shell (`Switch to GM Mode` / `Return to Character Mode`).*

![Stat Block](./img/36-statblock-pdf.png)

*`Stat Block` — generates the stat-block PDF payload.*

![Export JSON](./img/37-export-json.png)

*`Export JSON` — options plus "View JSON".*

![First Save](./img/38-share-copy.png)

*`First Save` (share flow) — Save to Local Folder / Save to GDrive before a build can be
shared.*

![Backup and Restore](./img/39-backup-restore.png)

*`Backup and Restore` — full local-database backup/restore.*

![Campaign Management](./img/40-campaign.png)

*`Campaign Management` — campaign records with options that gate content.*

![Feat Browser](./img/41-feat-browser.png)

*`Feat Browser` — every feat, with facet tabs, search, and "Add Free Feat".*

![Custom Pack](./img/43-custom-pack.png)

*`Custom Pack` — Character Options / Custom Items / Custom Pets, with
Export / Import / Remove Custom Pack.*

![Custom Ability Increases](./img/44-custom-ability-increases.png)

*`Custom Ability Increases`.*

![Custom Feat Choices](./img/45-custom-feat-choice.png)

*`Custom Feat Choices`.*

![Custom Skill Increases](./img/46-custom-skill-increases.png)

*`Custom Skill Increases`.*

![Help](./img/47-help.png)

*`Help`.*

![Licenses](./img/48-licenses.png)

*`Licenses` — the copyright/OGL text assembled from the `copyright` table.*

![Report Bug](./img/50-report-error.png)

*`Report Bug (v112.0)`.*

### 12.2 Build column: identity and level-1 choices

![Build column](./img/60-build-column-top.png)

*The top of `#divBuild`: Ancestry / Background / Class buttons, the level-1 cog row
(Set Abilities, Skill Training, Class/Deity Skill, Extra), then Heritage, Ancestry Feat,
and class-specific specials.*

![Ancestry select](./img/62-ancestry-select.png)

*Ancestry picker — Common / Uncommon / Rare / All facets.*

![Background select](./img/63-background-select.png)

*Background picker — General / Regional / Campaign / Custom / All.*

![Class select](./img/64-class-select.png)

*Class picker — All Classes / Core / Expanded / Class Archetypes.*

![Heritage select](./img/68-heritage-select.png)

*Heritage picker — the heritage is stored as a feat under `"Heritage Feat"`.*

![Ancestry Feat](./img/73-ancestry-feat.png)

*Ancestry feat picker (Dwarf Feat 1).*

![Set Starting Ability Boosts](./img/65-set-abilities.png)

*`Set Starting Ability Boosts` — the guided boost dialog. The `-`/`+` steppers are the
`Bv` widget; the counter is `4 − boosts already granted`.*

![Skill Training](./img/66-skill-training.png)

*`Remaining Skill Selections: N` — the `.prof-layout` proficiency rows.*

![Ability Boosts (level 5)](./img/78-ability-boosts.png)

*`Set Ability Boosts Level 5` — the same widget as level 1 but with exactly 4 boosts.*

![Skill Increase](./img/79-skill-increase.png)

*`Remaining Skill Selections: 1` — the skill-increase dialog, identical in structure to
skill training.*

### 12.3 Build column: feat slots

![Class Feat](./img/74-class-feat.png)

*Class feat picker — Class Feats / Dedication Feats / Archetype Class Feats / All Feats.
The `Dedication Feats` facet is what `showDedicationFeats` controls.*

![Class feat with filters open](./img/75-class-feat-filters.png)

*The same dialog with the facet panel expanded (the `img.button-filter` toggle).*

![Skill Feat](./img/76-skill-feat.png)

*Skill feat picker — Skill Feats / Archetype.*

![General Feat](./img/84-general-feat.png)

*General feat picker — General Feats / Skill Feats / Archetype Skill Feats / All Feats.*

These four dialogs are all the **same** `Au` listview class; only the facet tab list
and the source table differ. `feats_general` backs both the Skill Feat and the General
Feat pickers, filtered by trait.

## 13. Reusable widget inventory

| Widget | Class | Used for |
| --- | --- | --- |
| Cog button | `VT` | Every per-level "thing to choose" |
| Feat row | `eI`/`tI`/`ZT` | Feat slots in the build column |
| Proficiency row | `Zv` | Skill/lore rows in skill dialogs (`prof-layout`) |
| Ability stepper | `Bv` | `-`/`+` ability adjust |
| Ability grid | `Wv` | The six-ability block |
| Dropdown | `Xv` | Every `<select>` wrapper (`fjf_1` is the real `<select>`) |
| Listview | `Au` | Every chooser |
| Base dialog | `Ou` | Every modal |
| Filter/search header | `Jv` | Search box + `Names/Traits/Other` |
| Skull/lock/tick icons | `ds().ii2(el, bool)` | Show/hide helper |

## 14. Interaction recipes for automation

If you need to drive the app (for testing or migration):

1. **Never trust hit-testing** in dialogs. Query the element and call
   `el.click()`.
2. **`#divBuild` and `.div-listview-scroller` are the two scroll containers.**
   Set `scrollTop` before clicking anything that may be off-screen.
3. **The topmost modal is `.modal:last-of-type`.** With a backdrop, use
   `document.querySelectorAll('.modal')` and take the last one.
4. **Cog buttons are matched by their `.cogText` label**, not by position, because
   the number of cog buttons per level varies with class and feats.
5. **The primary footer button is `.modal-button` with text `Finished`.** Clicking
   `Cancel` silently discards. This is how test automations accidentally lose work.
6. **Saves are read from IndexedDB, not the DOM**, if you want to verify state:
   `indexedDB.open("pathbuilder2e_db").transaction("saves").objectStore("saves")`.
   Values are strings needing a second `JSON.parse`.
7. **`localStorage.prefLastCharacterID`** tells you which build is active at boot.

## 15. Screens a clone needs (and the original's names)

| Screen | Original name |
| --- | --- |
| Build column | `#divBuild` / `#divBuildLevels` |
| Main tab panel | `#tabbed-area` |
| Sidebar | `#mySidenav` |
| Character list | "Open Character" / "Load Character" |
| Save dialog | "Save: <name>" / "First Save" |
| Options | "Options" (Character Options) |
| New character | "New Character" |
| Export | "Export JSON", "Character Sheet PDF", "Stat Block PDF", "Share Copy of Character" |
| Backup | "Backup and Restore", "Local Database Backup" |
| GM | "GM Connection", "Switch to GM Mode", "Campaign Management" |
| Tools | "Feat Browser", "Spell Browser", "Remaster Information", "Licenses", "Help", "Patch Notes", "Report Error" |

The exhaustive inventory of dialog titles is
`grep -oE 'this\.sib_1\.innerHTML = "[^"]+"' pb-main.pretty.js | sort -u`.
