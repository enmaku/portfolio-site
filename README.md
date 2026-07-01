# Portfolio Site

Personal site for **David J. Perry**, deployed as [Focus Disorder](https://focusdisorder.com). The app is a Vue/Quasar SPA that combines a photography gallery and about page with four embedded interactive **projects**: Game Timer, Movie Vote, Dungeon Runner, and World Builder.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | Vue 3, Quasar 2, Pinia |
| Routing | Vue Router (hash mode — static hosting friendly) |
| Realtime | Firebase Realtime Database (RTDB) |
| ML (Dungeon Runner) | TensorFlow.js |
| Map viewport (World Builder) | PixiJS 8, pixi-viewport (lazy-loaded on route) |
| Tests | Node built-in test runner (`node --test`) |
| Lint / format | ESLint flat config (`eslint.config.js`), Prettier |

## Getting started

```bash
npm install
quasar dev
```

Open the dev server URL Quasar prints (typically `http://localhost:9000`). Routes use hash mode (`/#/`, `/#/about`, `/#/projects/...`).

### Environment variables

Copy `.env.example` to `.env` and fill in what you need:

| Variable group | Required for | Notes |
| --- | --- | --- |
| `VITE_TMDB_*` | Movie Vote search | Read Access Token preferred; API key also works |
| `VITE_FIREBASE_*` | Game Timer, Movie Vote, Dungeon Runner replay upload | One Firebase project; RTDB URL + web app config |
| `DUNGEON_RUNNER_ROOT` | Model sync scripts only | Sibling checkout of [dungeon-runner](https://github.com/enmaku/dungeon-runner) |
| `VITE_DUNGEON_RUNNER_NN_PICK_ADVENTURER` | Dungeon Runner dev only | Optional; restores NN adventurer pick locally (disabled in production due to bad bot behavior) |

Gallery, About, and World Builder work without any env vars. Multiplayer projects degrade gracefully when Firebase is unset (connection errors in UI). Dungeon Runner local play works without Firebase; replay upload is a no-op when unconfigured.

Restart `quasar dev` after changing `.env`.

## What's in the site

| Route | Shell | Purpose |
| --- | --- | --- |
| `/` | Portfolio (`MainLayout`) | Photo gallery (masonry grid) |
| `/about` | Portfolio | Résumé-style about page |
| `/projects/game-timer` | Project | Synchronized tabletop countdown timers (host/guest) |
| `/projects/movie-vote` | Project | Group movie picker with ranked voting (IRV, Borda, Condorcet, …) |
| `/projects/dungeon-runner` | Project | Single-device card match vs AI opponents |
| `/projects/world-builder` | Project | Procedural fantasy worlds — landmass pipeline, map overlays, generation controls |

**Projects** open in a dedicated shell without the portfolio masthead. Join links use `?room=<code>` on multiplayer project paths (Game Timer, Movie Vote).

Static portfolio pages and projects share one SPA. Hash routing keeps deployment simple on GitHub Pages; shareable routes get crawler-readable HTML at build time (see [ADR 0001](docs/adr/0001-hash-spa-with-static-link-previews.md)).

## Navigating the codebase

Feature-first layout under `src/features/`, with **World Builder** in a top-level `world-builder/` package. Start with [CONTEXT-MAP.md](CONTEXT-MAP.md) for bounded contexts and how they relate.

```
src/
├── pages/              Route entry components (thin; delegate to features)
├── layouts/
│   ├── MainLayout.vue          Portfolio shell (drawer, gallery, about)
│   └── projects/               Project shell (phone frame, overlays, join UX)
├── router/             Routes, document title/favicon from share catalog
├── stores/             Pinia stores (often thin wrappers over feature state)
├── composables/        World Builder page controller, generation, overlay state
├── share-metadata.js   Share metadata catalog (OG copy, favicons, unfurl flags)
├── features/
│   ├── p2p/            Star-room session core (host/guest, reconnect, RTDB wiring)
│   ├── game-timer/     Timer logic, components, P2P session
│   ├── movie-vote/     Election algorithms, TMDB, ballots, P2P session
│   ├── dungeon-runner/ Engine, UI, NN runtime, replay export, model catalog
│   └── share/          Static share-page HTML generation helpers
├── components/         Shared components (dungeon-runner card faces, world-builder UI)
└── assets/photos/      Gallery source images (+ generated thumbs)

world-builder/          World Builder package (`@world-builder` alias)
├── core/               Landmass pipeline, scalar fields, hydrology, validation
├── renderer/           PixiJS map viewport and overlay layers
├── worker/             Off-main-thread derived geography runs
├── docs/               Architecture seams, stage specs, test catalog
├── research/           Worldbuilding notes and map-display research
└── CONTEXT.md          Domain vocabulary (landmass, fields before labels, …)

public/
├── assets/dungeon-runner/   Runtime art for Dungeon Runner
├── models/dungeon-runner/   TF.js model trees + models.json catalog
└── icons/                   Favicons and social preview images

scripts/                Build-time tooling (thumbs, share pages, DR model sync)
docs/adr/               Architecture decision records
database.rules.json     Firebase RTDB security rules
```

### Where to look by task

| Task | Start here |
| --- | --- |
| Add or change a route | `src/router/routes.js`, `src/share-metadata.js` |
| Portfolio chrome / navigation | `src/layouts/MainLayout.vue` |
| Project shell / join links | `src/layouts/projects/`, `src/features/p2p/` |
| Multiplayer room sync | Feature `p2p/session.js` + `src/features/p2p/firebase/` |
| Election math (Movie Vote) | `src/features/movie-vote/election.js`, method files (`irv.js`, `borda.js`, …) |
| Game rules (Dungeon Runner) | `src/features/dungeon-runner/engine/kernel.js`, [CONTRACT.md](src/features/dungeon-runner/CONTRACT.md) |
| Landmass pipeline (World Builder) | `world-builder/core/`, [ARCHITECTURE-SEAMS.md](world-builder/docs/ARCHITECTURE-SEAMS.md) |
| World Builder page / map viewport | `src/pages/projects/WorldBuilderPage.vue`, `src/composables/useWorldBuilderPageController.js`, `world-builder/renderer/createWorldBuilderMapViewport.js` |
| Link previews / OG tags | `src/share-metadata.js`, `scripts/generate-share-pages.mjs` |
| Firebase paths / rules | `database.rules.json`, feature `firebase/rtdb.js` files |

### Domain language

Product terms are documented in CONTEXT files — read these before naming things or writing user-facing copy:

- [CONTEXT.md](CONTEXT.md) — site-wide (gallery, projects, sharing)
- [src/features/p2p/CONTEXT.md](src/features/p2p/CONTEXT.md) — host, guest, room, join links
- [src/features/game-timer/CONTEXT.md](src/features/game-timer/CONTEXT.md)
- [src/features/movie-vote/CONTEXT.md](src/features/movie-vote/CONTEXT.md)
- [src/features/dungeon-runner/CONTEXT.md](src/features/dungeon-runner/CONTEXT.md)
- [world-builder/CONTEXT.md](world-builder/CONTEXT.md) — landmass pipeline, settlements, trade networks, history log

Non-obvious architectural choices live in [docs/adr/](docs/adr/) (World Builder map stack: [ADR 0009](docs/adr/0009-world-builder-map-display-stack.md)).

## Firebase (RTDB)

All client Firebase usage is **Realtime Database** (`firebase/database`).

RTDB paths (see `database.rules.json`):

| Path | Used by |
| --- | --- |
| `gameTimerRooms/<suffix>` | Game Timer |
| `movieVoteRooms/<suffix>` | Movie Vote |
| `dungeonRunnerCompletedMatches/<matchId>` | Dungeon Runner replay archive (write-once at match over) |

Shared init: `src/features/p2p/firebase/createRtdbCore.js` ([ADR 0005](docs/adr/0005-shared-firebase-rtdb-core.md)).

Test rules locally:

```bash
npm run test:database-rules
```

## Testing and lint

```bash
npm test
npm run lint
npm run format   # Prettier write
```

Tests colocate with features and `world-builder/` as `*.test.js`. World Builder also has a dedicated `npm run test:world-builder` (includes file-size budget CI). ESLint config is `eslint.config.js` at the repo root (Quasar recommended + Vue essential + Prettier skip).

## Build and deploy

```bash
npm run build
```

`prebuild` generates photo thumbnails; `postbuild` generates static share-page HTML. CI publishes via [`.github/workflows/publish.yml`](.github/workflows/publish.yml) (GitHub Pages / custom domain).

## Dungeon Runner and the sibling repo

Dungeon Runner is a project inside this site with a playable version of IELLO Games' excellent tabletop game [Welcome to the Dungeon](https://iellogames.com/games/welcome-to-the-dungeon/). Contrast this with [dungeon-runner](https://github.com/enmaku/dungeon-runner), which is a separate repo for training, replay ingest, and **gated promotion** of neural network weights for the agents you can play against.

| This repo | dungeon-runner |
| --- | --- |
| Playable match UI, authoritative web game engine | BC/PPO training, replay verification |
| TF.js models in `public/models/dungeon-runner/` | H5 weights under `models/<semver>/`, `models/latest` symlink |
| Replay envelope export + RTDB upload at match over | Ingest archive, build training datasets |

After `npm run sync-dungeon-runner-model -- --from-latest` converts promoted H5 weights to TF.js after a release in the sibling repo. Full handoff: [scripts/MODEL_RELEASE.md](scripts/MODEL_RELEASE.md) and [CROSS_REPO.md](CROSS_REPO.md).

Expected sibling layout: `../dungeon-runner` (set `DUNGEON_RUNNER_ROOT` in `.env`).

## World Builder

World Builder is a procedural fantasy **world** generator: **landmass pipeline** (scalar **fields** → hydrology → **validation checks**), map overlays (rivers, resources, topography), and UI for seed-driven regeneration. Culture, settlement, and history simulation are on the roadmap ([#293](https://github.com/enmaku/portfolio-site/issues/293)).

| Layer | Location |
| --- | --- |
| Simulation (pure JS) | `world-builder/core/`, `world-builder/worker/` |
| Map viewport (PixiJS) | `world-builder/renderer/` |
| Vue page + state | `src/pages/projects/WorldBuilderPage.vue`, `src/composables/`, `src/stores/worldBuilderSettings.js` |

Generators mutate a **world document**; the renderer reads it and never runs pipeline logic ([ADR 0009](docs/adr/0009-world-builder-map-display-stack.md)). The PixiJS chunk loads lazily on `/projects/world-builder`. No Firebase — generation is client-side and deterministic from **geography seed**.

Architecture docs index: [world-builder/docs/README.md](world-builder/docs/README.md). Research: [world-builder/research/README.md](world-builder/research/README.md).

Run World Builder tests and file-size budget checks separately:

```bash
npm run test:world-builder
```

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Quasar dev server |
| `npm run dev:poll` | Dev with file polling (slow filesystems / VMs) |
| `npm run generate-thumbs` | Regenerate gallery thumbnails |
| `npm run generate-share-pages` | Regenerate static OG HTML |
| `npm run sync-dungeon-runner-model -- <semver>` | Sync one promoted model from dungeon-runner |
| `npm run sync-dungeon-runner-models` | Backfill all semver models |
| `npm run test:world-builder` | World Builder tests + production file-size budget |
| `npm run test:world-builder:coverage` | World Builder tests with core/renderer coverage |

## Quasar configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js). Notable local choices: hash router mode, `publicPath` from `GH_PAGES_BASE` for CI.
