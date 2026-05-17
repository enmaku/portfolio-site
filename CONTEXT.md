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

A path that receives its own pasted-link summary (title, description, image) so previews in chat and social apps read sensibly despite client-side routing.

Today that set is the site root (`/`), **About (navigation)** (`/about`), **Game Timer** (`/projects/game-timer`), and **Movie Vote** (`/projects/movie-vote`).

_Avoid_: “OG route,” “SEO page” unless the audience expects those terms.

### Shared link summary

What a user sees in a preview card when someone pastes a URL: title, short description, and preview image tied to one **shareable route**.

### Hash route

The in-application URL form (`#/…`) used by the SPA router for **projects** and most navigation.

### Canonical non-hash URL

The path without `#` served for some **shareable routes**; it redirects the browser into the matching **hash route** so previews and bookmarks both work.

### Résumé data

Structured professional profile consumed by the about page—not the prose marketing copy elsewhere on the site.

_Avoid_: “CV file” unless you mean exports.

### Feature folder

Implementation grouping under `src/features/` mapping to one domain area; not always the same as one user-facing **project**.

### Portfolio shell

Main-site chrome (`David J. Perry` masthead, drawer, primary navigation) wrapping the home and about experiences.

_Avoid_: Conflating with immersive **project** layouts.

### Project shell

Full-viewport layout for interactive **projects** (no portfolio masthead), giving controls and timers the full screen.

### Paste unfurl

What chat and social apps show when a URL is pasted—the same fields as the **shared link summary**. Hash SPA routes rely on crawler-readable HTML so the preview matches the route before client JavaScript runs.

_Avoid_: Assuming in-tab meta tag updates alone fix every preview provider.

## Relationships

- The **portfolio site** includes the **photo gallery**, about content (**résumé data**), navigation, and routed **projects**.
- **Photography (navigation)** names the same home experience as the **photo gallery**.
- **Portfolio shell** wraps the gallery and about; **project shell** wraps each `/projects/…` route.
- Drawer shortcuts use **detached project launch** so multiplayer **projects** typically run outside the shell tab.
- **Projects drawer sections** organize how **projects** appear in navigation without changing their public routes.
- Each **shareable route** has one **shared link summary**; **paste unfurl** surfaces those fields to link previews (root, about, and both **projects** listed above).
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
> **Domain owner:** “Home, **About (navigation)**, and both **projects**—each has a **shared link summary** so paste previews match what people share.”

## Flagged ambiguities

- **Project vs feature folder**: Resolved — a **project** is what ships to users (`/projects/…`). A **feature folder** holds code and may correspond 1:1 or include shared utilities.
- **Author vs site brand**: Resolved — **David J. Perry** is the credited person; **Focus Disorder** labels the deployed experience in aggregated metadata.
