# Context Map

## Contexts

- [Portfolio site](./CONTEXT.md) — Public personal site (gallery, about, navigation, branding, sharing).
- [Star-room P2P](./src/features/p2p/CONTEXT.md) — Shared realtime “room” connection pattern used by multiplayer projects (host/guest roles, reconnect).
- [Game Timer](./src/features/game-timer/CONTEXT.md) — Synchronized tabletop-style countdown timers for multiple players.
- [Movie Vote](./src/features/movie-vote/CONTEXT.md) — Group movie nomination, ballots, and configurable standard voting methods (IRV, Borda, Condorcet, Copeland, …).
- [Dungeon Runner](./src/features/dungeon-runner/CONTEXT.md) — Single-device deterministic card match vs AI opponents; completed **match** replays for later analysis.

## Relationships

- **Portfolio site → Shell**: Static pages (gallery, about) use the **portfolio shell**; each **project** uses its own **project shell** without the portfolio masthead.
- **Portfolio site → Projects**: Routes and navigation expose **Game Timer**, **Movie Vote**, and **Dungeon Runner** as first-class **projects** alongside static portfolio content.
- **Game Timer ↔ Star-room P2P**: Game Timer uses the star-room shell (host/guest roles, reconnect, **stable client identity**, **join links**); timer **snapshots** sync through an app-scoped persisted **room** like **Movie Vote**.
- **Movie Vote ↔ Star-room P2P**: Movie Vote uses the same shell so a **host** aggregates **participant** drafts and votes into **room**-level authority.
- **Movie Vote ↔ Game Timer**: Both use star-room roles and the same persisted **room** lifecycle shape; **Game Timer** stores one authoritative **snapshot** per **room** instead of vote-phase payloads.
- **Portfolio site ↔ sharing**: **Paste-unfurl eligible** routes are **shareable routes** with one **shared link summary** each; router, build, and runtime redirect read the **share metadata catalog** by `routePath` (no parallel share keys).
- **Portfolio site ↔ Star-room P2P**: **Join links** live on canonical `/projects/…` paths with `room` query params; **public site origin** anchors absolute URLs when builds need a stable host.
- **Dungeon Runner**: Local **match** play only (no star-room **room**); when a **match** reaches **match over**, a **completed match replay** may be archived remotely using the same Firebase project as multiplayer **projects** (write-only; no sync).

## Architecture

- [ADR 0001 — Hash SPA with static link previews](./docs/adr/0001-hash-spa-with-static-link-previews.md) — why paste previews use extra HTML entry points alongside the hash router.
- [ADR 0002 — Game Timer display wake delegated to Nosleep.js](./docs/adr/0002-delegate-game-timer-display-wake-to-library.md) — keep-display-on behavior uses a small dependency instead of custom wake/video code.
- [ADR 0004 — Movie Vote multi-method elections](./docs/adr/0004-movie-vote-multi-method-elections.md) — textbook IRV, Borda, Condorcet, Copeland, …; **no algorithmic tiebreak**; **Smith set** for Condorcet cycles; **Copeland score** leaders for Copeland ties; **voting method** locked at **voting phase**.
- [ADR 0003 — Movie Vote ranked-points IRV](./docs/adr/0003-movie-vote-ranked-points-per-irv-round.md) — **Superseded** by ADR 0004 (historical ranked-points hybrid per IRV round).
