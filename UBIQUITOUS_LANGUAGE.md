# Ubiquitous language (portfolio-site)

Site-wide terms: [`CONTEXT.md`](./CONTEXT.md) and [`CONTEXT-MAP.md`](./CONTEXT-MAP.md). Dungeon Runner play terms: [`src/features/dungeon-runner/CONTEXT.md`](./src/features/dungeon-runner/CONTEXT.md). Cross-repo links (no translation): [`CROSS_REPO.md`](./CROSS_REPO.md).

## Dungeon Runner + training chain

| Term | Definition | Sibling doc |
| --- | --- | --- |
| **Match** | Full play from **setup** through **match over** | dungeon-runner training uses same replay vocabulary in [CONTEXT.md](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md) |
| **Completed match replay** | **Replay envelope** archived at **match over** | ingest: [CROSS_REPO.md](./CROSS_REPO.md) |
| **Web deployed latest** | TF.js alias under `public/models/dungeon-runner/latest/` | ↔ dungeon-runner **production latest** |
| **TF.js model sync** | Maintainer step after sibling **gated promotion** | [scripts/MODEL_RELEASE.md](./scripts/MODEL_RELEASE.md) |

## Example dialogue

> **Dev:** "Is the neural **catalog** the same as equipment JSON?"  
> **Domain expert:** "No—**game data catalog** is static rules content; **model catalog** lists TF.js weight dirs after **TF.js model sync**."

> **Dev:** "Who owns replay skip reason codes?"  
> **Domain expert:** "Eligibility matches our import; granular skip codes are in dungeon-runner **replay pipeline documentation**, linked from CONTRACT."

## Flagged ambiguities

- **Catalog** without qualifier — resolve to **game data catalog** vs **model catalog**; see feature CONTEXT and [CROSS_REPO.md](./CROSS_REPO.md).
- **Empty dungeon run** — web/table win vs dungeon-runner Python sim training rule; not unified across repos.
