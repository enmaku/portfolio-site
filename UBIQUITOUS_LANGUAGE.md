# Ubiquitous Language — portfolio-site

Canonical vocabulary for this repo and the shared **Dungeon Runner product chain** with [dungeon-runner](https://github.com/enmaku/dungeon-runner). Site-wide terms: [`CONTEXT.md`](./CONTEXT.md), [`CONTEXT-MAP.md`](./CONTEXT-MAP.md). Sibling copy: [`dungeon-runner/UBIQUITOUS_LANGUAGE.md`](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md).

## Site (portfolio)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Project** | Interactive mini-app at `/projects/…` | App (whole SPA), experiment |
| **Portfolio shell** | Masthead + drawer chrome for gallery/about | Project shell |
| **Project shell** | Full-viewport layout for **projects** (no masthead) | Fullscreen layout (browser API) |
| **Shareable route** | Path with paste-preview HTML + **shared link summary** | OG route, every hash path |
| **David J. Perry** | Author name in chrome and credits | Focus Disorder (in masthead) |
| **Focus Disorder** | Deployed site brand in external previews | Author name in all contexts |

## Match play (Dungeon Runner)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Match** | One full play from **setup** through **match over** | Game (ambiguous), session |
| **Match over** | **Web game engine** terminal `match-over` with a recorded winner; authoritative for play and replays | Sim forfeit, finished game |
| **Sim empty-pile forfeit** | dungeon-runner **Python training sim** only: no winner when bidding ends on empty pile; not **match over** | Match over, runner loss |
| **Dungeon run** | One runner’s lane attempt within a **match** | Run (ambiguous with training run) |
| **Empty dungeon run** | **Dungeon run** with no **monsters** in the pile when the runner goes in; table rules: immediate success | Stuck phase, runner loss |
| **Setup** | Seat count and **opponent** types before a **match** | Config, lobby |
| **Opponent** | Non-human seat (`nn` or **Randombot**) | Bot (vague), in-play role badge |
| **Randombot** | **Opponent** with setup role `randombot` (CONTRACT id) | Random bot, **RandomBot** (code only) |
| **Human player seat** | Sole `human` role after seat shuffle; **actor seat id** used in **history** | `seat-1`, human seat (vague) |
| **Seed** | Integer RNG root; same **setup** + **seed** ⇒ same outcomes | Random seed (casual) |
| **History** | Ordered canonical actions + per-step RNG metadata | Game log, action log |
| **Replay envelope** | Versioned serialized **match** for export/archive | Debug-only JSON |
| **Replay envelope version** | Integer schema id (`1` in v1) | Schema version (vague) |
| **Replay envelope contract (v1)** | Normative fields in [`CONTRACT.md`](./src/features/dungeon-runner/CONTRACT.md) | Pipeline doc as field authority |
| **Presentation pace** | Optional `presentationSpeedProfile` (`cinematic` \| `brisk`); debug/replay UI only | Training label, rules state |
| **Completed match replay** | **Replay envelope** stored at **match over** | Telemetry, consent flow |
| **Web game engine** | `engine/kernel.js` — authoritative rules for play and replay | Python sim, duplicate rules |

## Game content

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Game data catalog** | Single source for **equipment**, **monster**, **adventurer** definitions | Model catalog, display catalog alone |
| **Model catalog** | `public/models/dungeon-runner/models.json` — TF.js weight ids | Game data catalog, bare catalog |
| **Equipment** | Bid/play card type by stable equipment id | Item (vague) |
| **Monster** | Lane card type by **species** id with **strength** | Creature, enemy |
| **Species** | Canonical **monster** id (e.g. `goblin`) | Strength as primary key |
| **Adventurer** | Runner class (Warrior, Barbarian, Mage, Rogue) | Hero (product language) |
| **Neural opponent** | **Opponent** with setup role `nn`; uses TF.js (`modelId` on actions) | AI (vague) |

## Pipeline gates (training ingest)

Producer upload happens at **match over**; dungeon-runner consumption is gated in stages. Detail: [dungeon-runner `CONTEXT.md`](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md).

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Ingest eligibility** | Export shape passes `importReplayEnvelope`; not full replay proof | Valid replay, archived |
| **Verified replay** | Replay re-stepped in **web game engine** to **match over** | Import ok, uploaded |
| **Completed match replay archive** | RTDB store of envelopes at **match over** | Live **room** read |

## Model release (two repos)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Promoted version** | Semver identity of shipped weights (H5 in dungeon-runner, TF.js here) | Training run id (`bc-*`) |
| **Gated promotion** | dungeon-runner `publish` after **promotion gates** | TF.js sync, npm deploy |
| **Production latest** | dungeon-runner `models/latest/` symlink (H5) | This repo’s `latest/` folder alone |
| **Web deployed latest** | `public/models/dungeon-runner/latest/` — default `modelId: 'latest'` | Symlink to semver dir |
| **Deployed model version** | Immutable semver TF.js dir under `public/models/dungeon-runner/` | Ephemeral run folder |
| **TF.js model sync** | Convert promoted H5 → TF.js + **model catalog** + maybe **web deployed latest** | Promote, train |
| **Two-repo model release** | Promote in dungeon-runner, then sync + **release smoke** here | Single checklist |
| **Epic v1 success bar** | Training milestone: ≥1 **gated promotion** + documented **two-repo model release** (see dungeon-runner UL) | Pipeline scripts exist only |
| **Release smoke** | Manual `/projects/dungeon-runner` after sync | CI WebGL-only gate |

## Multiplayer (other projects)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Room** | Star-room persisted collaboration state (`gameTimerRooms`, `movieVoteRooms`) | Dungeon Runner archive |
| **Host** / **Guest** | Star-room roles; **host** owns authoritative **room** payload | NN **opponent** |
| **Stable client identity** | Browser principal for reconnect (not Firebase Auth) | Login, account |
| **Path-scoped RTDB access** | Rules limited to app paths + replay archive (no root RW) | Open database |

Detail: [`src/features/p2p/CONTEXT.md`](./src/features/p2p/CONTEXT.md), Game Timer, Movie Vote contexts in [`CONTEXT-MAP.md`](./CONTEXT-MAP.md).

## Relationships

- **Dungeon Runner** is local **match** play only (no **room**); **completed match replay** uploads are write-only to the **archive**.
- **Web game engine** defines play and replay; dungeon-runner ingests archives and trains against **web-authoritative labels**.
- **Promoted version** is shared semver; **production latest** (H5) and **web deployed latest** (TF.js) track the same production pointer after **two-repo model release**.
- **Game data catalog** is unrelated to **model catalog**; never use “catalog” without a qualifier.
- Multiplayer **projects** share **path-scoped RTDB access** on the same Firebase project as the replay **archive**.

## Example dialogue

> **Dev:** "Should we read the replay archive during a **match**?"  
> **Domain expert:** "No — the **completed match replay archive** is for post-**match over** upload and maintainer ingest, not live play."

> **Dev:** "Where do goblin stats live?"  
> **Domain expert:** "**Game data catalog** — one row per **species**. **Model catalog** is only NN semver dirs after **TF.js model sync**."

> **Dev:** "Empty dungeon pile at end of bidding?"  
> **Domain expert:** "**Web game engine** treats it as an immediate successful **dungeon run** (then pick-adventurer). **Python training sim** in dungeon-runner may **forfeit** with no winner — see flagged note; table rules here win at runtime."

> **Dev:** "A **Randombot** pass has no `modelId` — is that a human action?"  
> **Domain expert:** "It's a **Non-NN history step**, not a **Human step**. Only actions by the **human player seat** count for imitation labels."

> **Dev:** "Game Timer **host** vs Dungeon Runner **opponent**?"  
> **Domain expert:** "Different domains — star-room **host**/**guest** vs **setup** **opponent** seats. Don't overload **host**."

## Flagged ambiguities

- **Catalog** — **game data catalog** (rules content) vs **model catalog** (TF.js ids).
- **Match** vs game — use **match** / **dungeon run** in docs and UI copy.
- **Match over** vs **sim empty-pile forfeit** — **match over** is web-only. Sim forfeit exists because early models learned to pass until a random seat won; anti-exploit rule remains; training/execution divergence is a known **local minima**.
- **Empty dungeon run** vs **empty dungeon pile at bidding end** — **empty dungeon run** is any **dungeon run** into an empty pile (often mid-**match** success); the bidding-end case is the one that diverges in sim (forfeit vs success).
- **History** — no in-match history panel; **replay envelope** is the inspection/export surface.
- **Human player seat** vs **Human step** vs **Non-NN history step** — resolved: one **human player seat** per **match**; **Human step** = that seat acted; **Non-NN history step** includes **Randombot** without `modelId`.
- **Randombot** vs `RandomBot` — product term **Randombot**; setup id `randombot`; **RandomBot** only for Python implementation names.
- **is_human** — not an envelope field; dungeon-runner sets it when **actor seat id** equals the **human player seat** at dataset build.

## See also

- [dungeon-runner **Evaluation & promotion**](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md#evaluation--promotion) — **frozen eval suite**, **promotion gates**, sim vs replay legs (training repo only)
- [`src/features/dungeon-runner/CONTEXT.md`](./src/features/dungeon-runner/CONTEXT.md) — feature glossary  
- [`src/features/dungeon-runner/CONTRACT.md`](./src/features/dungeon-runner/CONTRACT.md) — replay + engine contracts  
- [`scripts/MODEL_RELEASE.md`](./scripts/MODEL_RELEASE.md) — sync runbook  
- [`CROSS_REPO.md`](./CROSS_REPO.md) — sibling paths and doc map  
- [`dungeon-runner/UBIQUITOUS_LANGUAGE.md`](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md) — training pipeline tables (duplicate shared sections)
