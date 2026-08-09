# Context Map

## Contexts

- [Portfolio site](./CONTEXT.md) — Public personal site (gallery, about, navigation, branding, sharing).
- [Star-room P2P](./src/features/p2p/CONTEXT.md) — Shared realtime “room” connection pattern used by multiplayer projects (host/guest roles, reconnect).
- [Game Timer](./src/features/game-timer/CONTEXT.md) — Synchronized tabletop-style countdown timers for multiple players.
- [Movie Vote](./src/features/movie-vote/CONTEXT.md) — Group movie nomination, ballots, and configurable standard voting methods (IRV, Borda, Condorcet, Copeland, …).
- [Dungeon Runner](./src/features/dungeon-runner/CONTEXT.md) — Single-device deterministic card match vs AI opponents; completed **match** replays for later analysis.
- [Game Manager](./src/features/game-manager/CONTEXT.md) — Signed-in **account owner** **collection**, **saved players**, **play sessions**, and **v1 statistics**; optional companion to **Game Timer** (see [#272](https://github.com/enmaku/portfolio-site/issues/272)).
- [World Builder](./world-builder/CONTEXT.md) — Desktop procedural **worlds**: **landmass pipeline**, **culture engine**, logistics-bound **settlements** and **trade routes**, **history log** and **rivalry** (see [#293](https://github.com/enmaku/portfolio-site/issues/293); terrain research: [DF notes](./world-builder/research/dwarf-fortress-terrain-notes.md); map viewport: [ADR 0009](./docs/adr/0009-world-builder-map-display-stack.md); sail traversability: [ADR 0010](./docs/adr/0010-world-builder-sail-overlay-traversability.md); bulk population: [ADR 0011](./docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md); present-day session: [ADR 0014](./docs/adr/0014-world-builder-present-day-session-no-committed-tips.md); expedition budget and settlement merge: [ADR 0015](./docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md); cooperative progress yielding: [ADR 0016](./docs/adr/0016-world-builder-cooperative-progress-yielding.md); off-map port-mediated trade: [ADR 0017](./docs/adr/0017-world-builder-off-map-port-mediated-trade.md); faction territory primary claim: [ADR 0018](./docs/adr/0018-world-builder-faction-territory-primary-claim.md); sticky faction membership: [ADR 0019](./docs/adr/0019-world-builder-sticky-faction-membership.md); projected might and war exhaustion: [ADR 0020](./docs/adr/0020-world-builder-projected-might-and-war-exhaustion.md); faction territory control not membership-only: [ADR 0021](./docs/adr/0021-world-builder-faction-territory-control-not-membership-only.md); soft power two passes: [ADR 0022](./docs/adr/0022-world-builder-soft-power-two-passes.md)).

## Relationships

- **Portfolio site → Shell**: Static pages (gallery, about) use the **portfolio shell**; each **project** uses its own **project shell** without the portfolio masthead.
- **Portfolio site → Projects**: Routes and navigation expose **Game Timer**, **Movie Vote**, **Dungeon Runner**, and **Game Manager** as first-class **projects** alongside static portfolio content.
- **Game Manager ↔ Portfolio site**: **Game Manager** uses a **mobile-first project shell** at launch (**Projects → Mobile**); **manager capability** stays shell-agnostic so a future **desktop project shell** can attach without rewriting domain behavior.
- **Game Manager → Firebase Auth**: **Account owner** identity is Firebase Auth (Google and email/password in v1); durable data lives in the **manager store**, not in timer **rooms**.
- **Game Manager ↔ Game Timer**: Separate **projects**; optional **timer leg** / **manager-linked timer** and **game end** export. Standalone **Game Timer** stays usable without signing in. Handoff transport deferred.
- **Game Manager → Catalog**: BoardGameGeek-backed **catalog** for collection and session game pick; **custom collection entries** when search fails; **catalog attribution** required in UI. **Collection** is ownership ([ADR 0023](./docs/adr/0023-game-manager-collection-is-ownership-not-play-history.md)), distinct from plays.
- **Game Manager → identity (future)**: v1 is **account owner**–scoped; **recorded players** may be **unlinked** until **player claim** links them to authenticated accounts with backfill and shared future visibility.
- **Game Manager → persistence**: **Manager store** in **Firestore**; **Game Timer** **room** sync unchanged in **Realtime Database**.
- **Game Timer ↔ Star-room P2P**: Game Timer uses the star-room shell (host/guest roles, reconnect, **stable client identity**, **join links**); timer **snapshots** sync through an app-scoped persisted **room** like **Movie Vote**.
- **Movie Vote ↔ Star-room P2P**: Movie Vote uses the same shell so a **host** aggregates **participant** drafts and votes into **room**-level authority.
- **Movie Vote ↔ Game Timer**: Both use star-room roles and the same persisted **room** lifecycle shape; **Game Timer** stores one authoritative **snapshot** per **room** instead of vote-phase payloads.
- **Portfolio site ↔ sharing**: **Paste-unfurl eligible** routes are **shareable routes** with one **shared link summary** each; router, build, and runtime redirect read the **share metadata catalog** by `routePath` (no parallel share keys).
- **Portfolio site ↔ Star-room P2P**: **Join links** live on canonical `/projects/…` paths with `room` query params; **public site origin** anchors absolute URLs when builds need a stable host.
- **Dungeon Runner**: Local **match** play only (no star-room **room**); when a **match** reaches **match over**, a **completed match replay** may be archived remotely using the same Firebase project as multiplayer **projects** (write-only; no sync).
- **World Builder**: Desktop app with browser-capable viewport (Tauri + lazy SPA chunk); **landmass pipeline** (fields-first geography + **logistics pass**) and **culture engine** inform simulation—no shared runtime with multiplayer **projects** in v1. Map display: [ADR 0009](./docs/adr/0009-world-builder-map-display-stack.md) (PixiJS + pixi-viewport). Research: [index](./world-builder/research/README.md), [Dwarf Fortress terrain notes](./world-builder/research/dwarf-fortress-terrain-notes.md).

## Sibling repositories

- [dungeon-runner](https://github.com/enmaku/dungeon-runner) — Replay ingest, BC/PPO training, **gated promotion**, H5 **production latest**. Shared terms: [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md) ↔ [dungeon-runner `UBIQUITOUS_LANGUAGE.md`](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md). Index: [CROSS_REPO.md](./CROSS_REPO.md).
- **Dungeon Runner** (this repo) ↔ dungeon-runner: playable **match** and **replay envelope** export here; training pipeline and promote/sync handoff in sibling repo—see [Dungeon Runner](./src/features/dungeon-runner/CONTEXT.md) and [MODEL_RELEASE.md](./scripts/MODEL_RELEASE.md).

## Architecture

- [ADR 0001 — Hash SPA with static link previews](./docs/adr/0001-hash-spa-with-static-link-previews.md) — why paste previews use extra HTML entry points alongside the hash router.
- [ADR 0002 — Game Timer display wake delegated to Nosleep.js](./docs/adr/0002-delegate-game-timer-display-wake-to-library.md) — keep-display-on behavior uses a small dependency instead of custom wake/video code.
- [ADR 0004 — Movie Vote multi-method elections](./docs/adr/0004-movie-vote-multi-method-elections.md) — textbook IRV, Borda, Condorcet, Copeland, …; **no algorithmic tiebreak**; **Smith set** for Condorcet cycles; **Copeland score** leaders for Copeland ties; **voting method** locked at **voting phase**.
- [ADR 0006 — Star-room session core](./docs/adr/0006-star-room-session-core.md) — shared host/guest wire factory for Timer and Movie Vote; `guestPresence` loose vs strict; feature facades unchanged.
- [ADR 0003 — Movie Vote ranked-points IRV](./docs/adr/0003-movie-vote-ranked-points-per-irv-round.md) — **Superseded** by ADR 0004 (historical ranked-points hybrid per IRV round).
