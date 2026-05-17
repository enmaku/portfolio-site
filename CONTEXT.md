# Portfolio site

Personal site for **David J. Perry**: photography gallery, résumé-style about content, navigation, and embedded small multiplayer **projects**.

## Language

### David J. Perry

The public-facing author name shown in chrome, titles, and primary branding.

_Avoid_: Mixing casually with deployed domain branding (“Focus Disorder”) when talking about attribution.

### Focus Disorder

The **deployed site** name and identity used beside **David J. Perry** in shared-link and social-preview copy for the live domain.

_Avoid_: Treating it as the same thing as author credit in all contexts.

### Project

An interactive mini-app surfaced from the portfolio (e.g. Game Timer, Movie Vote), distinct from static gallery or prose pages.

_Avoid_: “App” alone (ambiguous with the whole SPA); “experiment” unless you explicitly mean disposable.

### Photo gallery

The masonry grid of photographs on the home route, sourced from checked-in imagery and thumbnails.

_Avoid_: “Portfolio grid” — overloaded with résumé connotations.

### Photography (navigation)

Drawer and toolbar label for the `/` route—the same surface as the **photo gallery**.

### About (navigation)

Drawer and toolbar label for the `/about` route—the **résumé data** / about page.

### Projects drawer sections

“Mobile” and “Desktop” groupings in the drawer’s Projects expansion; listed **projects** live under Mobile today while Desktop is a placeholder.

### Detached project launch

Opening a **project** from the portfolio drawer in a new browser tab (`noopener`) instead of navigating inside the current shell tab.

### Public site origin

Canonical HTTPS base for the deployed site (`focusdisorder.com`), used when building absolute Open Graph URLs and stable join/share links.

### Shareable route

A path marked **paste-unfurl eligible** in the share metadata catalog: it gets its own **shared link summary** and crawler-readable HTML so chat and social previews read sensibly despite client-side routing.

The eligible set is home (`/`), **About (navigation)** (`/about`), **Game Timer**, **Movie Vote**, and **Dungeon Runner**—only routes meant to be pasted publicly.

_Avoid_: “OG route,” “SEO page” unless the audience expects those terms; treating every routed page as shareable when it only needs a tab title.

### Paste-unfurl eligible

Catalog flag meaning “generate static preview HTML and expose a full **shared link summary** for this path.” Home uses the site root document; other **shareable routes** use their own canonical non-hash path.

_Avoid_: Inferring eligibility from “is it a **project**?” alone—about and home are shareable but not **projects**.

### Route document chrome

Per-route browser tab title and favicon, derived from the **share metadata catalog** for **shareable routes** and sensible defaults elsewhere (e.g. 404).

_Avoid_: Conflating tab chrome with **paste unfurl**—not every titled route needs preview HTML.

### Share metadata catalog

The single path-keyed ordered list of public routes with preview copy, canonical path, favicon id, and **paste-unfurl eligible** flag. Each row’s path is the router path—no share key or other parallel aliases.

_Avoid_: “Share key” as a second name developers must keep in sync with paths; duplicating title or favicon on individual route definitions.

### Shared link summary

What a user sees in a preview card when someone pastes a URL: title, short description, and preview image tied to one **shareable route**.

### Hash route

The in-application URL form (`#/…`) used by the SPA router for **projects** and most navigation.

### Canonical non-hash URL

The path without `#` for a **shareable route**; crawlers read static HTML with preview tags, then the browser is sent to the matching **hash route** (query string preserved for join links).

_Avoid_: Maintaining a second ad hoc list of which paths trampoline—the same **paste-unfurl eligible** set drives static preview HTML and runtime redirect.

### Résumé data

Structured professional profile consumed by the about page—not the prose marketing copy elsewhere on the site.

_Avoid_: “CV file” unless you mean exports.

### Feature folder

Implementation grouping under `src/features/` mapping to one domain area; not always the same as one user-facing **project**.

### Portfolio shell

Main-site chrome (`David J. Perry` masthead, drawer, primary navigation) wrapping the home and about experiences.

_Avoid_: Conflating with immersive **project** layouts.

### Project shell

Full-viewport layout for interactive **projects** (no portfolio masthead), giving controls and timers the full screen. **Game Timer**, **Movie Vote**, and **Dungeon Runner** use the same shell pattern (immersive chrome, trapped browser back).

_Avoid_: “Fullscreen layout” when meaning **project shell** (confuses with the browser Fullscreen API toggle on **Game Timer**).

### Paste unfurl

What chat and social apps show when a URL is pasted—the same fields as the **shared link summary**. Hash SPA routes rely on crawler-readable HTML so the preview matches the route before client JavaScript runs.

_Avoid_: Assuming in-tab meta tag updates alone fix every preview provider.

## Relationships

- The **portfolio site** includes the **photo gallery**, about content (**résumé data**), navigation, and routed **projects**.
- **Photography (navigation)** names the same home experience as the **photo gallery**.
- **Portfolio shell** wraps the gallery and about; **project shell** wraps each `/projects/…` route.
- Drawer shortcuts use **detached project launch** so multiplayer **projects** typically run outside the shell tab.
- **Projects drawer sections** organize how **projects** appear in navigation without changing their public routes.
- Each **paste-unfurl eligible** path is a **shareable route** with exactly one **shared link summary**; **paste unfurl** surfaces those fields to link previews.
- The **share metadata catalog** is the authority for **shared link summary** fields and **route document chrome** on **shareable routes**; router paths align with catalog paths rather than parallel ids.
- **Paste-unfurl eligible** paths (except home) share one canonical→**hash route** mapping for runtime redirect and static preview HTML.
- **Public site origin** anchors absolute preview metadata and default join URLs when the runtime location is unknown.
- User-facing navigation labels **projects** consistently with public routes (`/projects/…`).
- **Focus Disorder** scopes how the deployed site introduces itself externally; **David J. Perry** remains the authored-by line.

## Example dialogue

> **Dev:** “If marketing pastes `/projects/game-timer` without `#`, how do observers still land in the SPA?”  
> **Domain owner:** “We treat that **canonical non-hash URL** as a trampoline into the matching **hash route**; previews use the **shareable route** metadata for the summary card.”

> **Dev:** “Should the masthead say **Focus Disorder**?”  
> **Domain owner:** “No — toolbar stays **David J. Perry**; **Focus Disorder** is primarily for previews and positioning of the deployed **site**. They’re deliberately split.”

> **Dev:** “Why does `/projects/game-timer` look different from `/about`?”  
> **Domain owner:** “**Portfolio shell** vs **project shell**—projects are immersive; about and home keep the standard site chrome.”

> **Dev:** “Why does Game Timer open in a new tab from the drawer?”  
> **Domain owner:** “**Detached project launch** keeps the gallery/about shell stable while timers or votes run fullscreen in their own tab.”

> **Dev:** “Which URLs get their own preview card copy?”  
> **Domain owner:** “Only **paste-unfurl eligible** routes—home, about, and each shipped **project** people might paste. Ephemeral dev routes don’t belong in the catalog.”

> **Dev:** “Is Dungeon Runner shareable?”  
> **Domain owner:** “Yes—it’s a **project** with a public route, same as Game Timer and Movie Vote.”

## Flagged ambiguities

- **Project vs feature folder**: Resolved — a **project** is what ships to users (`/projects/…`). A **feature folder** holds code and may correspond 1:1 or include shared utilities.
- **Author vs site brand**: Resolved — **David J. Perry** is the credited person; **Focus Disorder** labels the deployed experience in aggregated metadata.
