# Cross-repo vocabulary (portfolio-site ↔ dungeon-runner)

This repo owns the playable **match**, **replay envelope** export, and TF.js **web deployed latest**. [dungeon-runner](https://github.com/enmaku/dungeon-runner) owns replay ingest, BC/PPO training, **gated promotion**, and H5 **production latest**. Terms are **not translated** across repos—link to the other glossary and keep local names.

**Local play glossary:** [`src/features/dungeon-runner/CONTEXT.md`](./src/features/dungeon-runner/CONTEXT.md)  
**Sibling training glossary:** [`dungeon-runner` `CONTEXT.md`](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md) (checkout: `$DUNGEON_RUNNER_ROOT/CONTEXT.md`)

## Sibling checkout

| Env var | Points at |
| --- | --- |
| `DUNGEON_RUNNER_ROOT` | dungeon-runner repo root |
| `PORTFOLIO_SITE_ROOT` | (set in dungeon-runner) this repo |

Default sibling layout: `../dungeon-runner` and `../portfolio-site`.

## Shared documentation

| Topic | portfolio-site | dungeon-runner |
| --- | --- | --- |
| Play + envelope glossary | [`src/features/dungeon-runner/CONTEXT.md`](./src/features/dungeon-runner/CONTEXT.md) | [`CONTEXT.md`](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md) |
| Cross-repo index | this file | [`CROSS_REPO.md`](https://github.com/enmaku/dungeon-runner/blob/main/CROSS_REPO.md) |
| Replay envelope v1 (normative fields) | [`src/features/dungeon-runner/CONTRACT.md`](./src/features/dungeon-runner/CONTRACT.md) | cross-link in training `CONTEXT.md` |
| Ingest extensions (skip codes, RTDB layout) | CONTRACT → sibling pipeline doc | [`docs/replay-pipeline.md`](https://github.com/enmaku/dungeon-runner/blob/main/docs/replay-pipeline.md) |
| Maintainer runbooks | [`scripts/MODEL_RELEASE.md`](./scripts/MODEL_RELEASE.md) | [`docs/replay-pipeline.md`](https://github.com/enmaku/dungeon-runner/blob/main/docs/replay-pipeline.md) |
| Web engine authority | CONTRACT + kernel | [ADR 0001](https://github.com/enmaku/dungeon-runner/blob/main/docs/adr/0001-web-game-engine-authoritative.md) |
| Promoted semver + `latest` symlink | MODEL_RELEASE + feature CONTEXT | [ADR 0002](https://github.com/enmaku/dungeon-runner/blob/main/docs/adr/0002-promoted-version-semver-and-latest-symlink.md) |
| Site-wide contexts | [`CONTEXT-MAP.md`](./CONTEXT-MAP.md) | — |

## Cross-linked terms (same concept, local name)

| portfolio-site | dungeon-runner (`CONTEXT.md`) | Notes |
| --- | --- | --- |
| **Completed match replay** | **Completed match replay** | Uploaded at **match over**; ingested for training. |
| **Replay envelope** | **Replay envelope** | Same serialized shape; CONTRACT is normative. |
| **Completed match replay archive** | **Completed match replay archive** | RTDB root; **archive listing** for maintainer ingest. |
| **Match over** | **Match over** (via verifier `match-over`) | Required for archival and **verified replay**. |
| **TF.js model sync** | **TF.js model sync** | After **gated promotion** in sibling repo. |
| **History** | **History** (envelope) / **Derived training row** (training) | Ordered actions in envelope; training adds obs/mask rows per action step. |

## Cross-linked pairs (related concepts, different names)

| portfolio-site | dungeon-runner | Relationship |
| --- | --- | --- |
| **Web deployed latest** | **Production latest** | `public/models/dungeon-runner/latest/` ↔ `models/latest` symlink; default `modelId: 'latest'`. |
| **Deployed model version** | **Promoted version** | Semver TF.js tree here ↔ semver H5 dir there after sync. |
| **Model catalog** | **Model catalog** | `models.json` here; not **game data catalog**. |
| **Game data catalog** | (no training glossary term) | Static equipment/monsters; not neural weights. |
| engine / `kernel.js` | **Web game engine** | Authoritative rules; dungeon-runner Node harness imports this repo. |
| `encodeActionIndex` | **Policy action index** | Export for verify/dataset; indices 0–25 not recomputed in Python. |
| **Non-NN history step** (CONTRACT) | **Non-NN history step** / **Human step** | No `modelId`; human seat + `is_human` only at dataset build in dungeon-runner. |
| (no promote step) | **Gated promotion** | portfolio-site sync only; promotion is dungeon-runner `publish`. |

## Intentional divergences (do not unify)

| Topic | portfolio-site | dungeon-runner | Cross-link |
| --- | --- | --- | --- |
| **Match** vs “game” | **Match** is canonical | Avoid “game” in training docs | feature [`CONTEXT.md`](./src/features/dungeon-runner/CONTEXT.md) |
| **Empty dungeon run** | Runner wins on empty pile (web/table) | Python sim trained runner **loss** on empty pile | feature Flagged ambiguities |
| **Catalog** | **Game data catalog** vs neural **model catalog** | **Model catalog** = weights only | use full term in docs and UI copy |
| Envelope `version` | `importReplayEnvelope` rejection rules | Ingest integer `1` strict | eligibility parity tests; edge-type doc in pipeline |

## Coordination issues

| Tracker | Repo |
| --- | --- |
| [#128](https://github.com/enmaku/portfolio-site/issues/128) umbrella | portfolio-site |
| [#127](https://github.com/enmaku/portfolio-site/issues/127) TF.js sync | portfolio-site |
| [#11](https://github.com/enmaku/dungeon-runner/issues/11) epic cross-repo | dungeon-runner |
