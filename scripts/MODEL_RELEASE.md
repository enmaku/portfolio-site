# Dungeon Runner — two-repo model release

Domain terms: [UBIQUITOUS_LANGUAGE.md](../UBIQUITOUS_LANGUAGE.md) ↔ [dungeon-runner UBIQUITOUS_LANGUAGE.md](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md). Exhaustive training glossary: [dungeon-runner CONTEXT](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md). Index: [CROSS_REPO.md](../CROSS_REPO.md).

## Repos

| Repo | Role |
|------|------|
| [dungeon-runner](https://github.com/enmaku/dungeon-runner) | Training, **gated promotion**, H5 weights under `models/<promoted version>/`, **production latest** symlink at `models/latest` |
| portfolio-site (this repo) | TF.js artifacts under `public/models/dungeon-runner/`, **model catalog** (`models.json`), playable build |

## After promote (dungeon-runner)

1. Confirm **gated promotion** succeeded (`publish` exit 0) and `models/latest` symlink points at the new **promoted version**.
2. From portfolio-site root, with optional local checkout:

   ```bash
   # .env — sibling dungeon-runner checkout (preferred over shallow clone)
   DUNGEON_RUNNER_ROOT=../dungeon-runner
   # Python with TensorFlow + tensorflowjs (training venv)
   PYTHON_BIN=../dungeon-runner/.venv/bin/python

   npm run sync-dungeon-runner-model -- v0.2.01
   # or, without typing semver:
   npm run sync-dungeon-runner-model -- --from-latest
   ```

3. `sync` converts `models/<id>/policy.weights.h5` → `public/models/dungeon-runner/<id>/` (logits-only, unchanged converter).
4. **Web deployed latest** (`public/models/dungeon-runner/latest/`) is overwritten **only** when `<id>` equals dungeon-runner **production latest** (symlink target). Older semver re-sync updates that tree only.
5. **Model catalog** (`models.json`) is regenerated automatically; existing `publishedAt` values are preserved and new semver entries pick up `promoted_at` from the dungeon-runner promotion ledger when `DUNGEON_RUNNER_ROOT` is set.

## Model catalog (`models.json`)

Each entry is `{ "id": "<modelId>", "publishedAt"?: "<ISO-8601>" }`.

- **`publishedAt`** — when the **promoted version** was published in dungeon-runner. Backfilled legacy ids (`v0.1.29a`, `v0.1.30a`) use first-commit dates on `models/<id>/policy.weights.h5`; newer semver uses first-commit dates on the promoted weights dir until the promotion ledger is authoritative.
- **`latest`** — **web deployed latest** alias; `publishedAt` tracks the current **production latest** promoted version.
- Regenerating the catalog preserves existing timestamps and merges `promoted_at` from `models/promotions.jsonl` / `models/<id>/promotion.json` for newly synced ids.

## Semver vs `latest`

- **`public/models/dungeon-runner/<semver>/`** — immutable **deployed model version** identity for replay/debug pins. Routine releases add dirs; do not delete old semver trees.
- **`public/models/dungeon-runner/latest/`** — moving **web deployed latest** alias; default NN setup uses `modelId: 'latest'`. Refreshed only when sync target is **production latest**.

## Backfill (`--all`)

```bash
npm run sync-dungeon-runner-models
```

Converts every semver dir under dungeon-runner `models/`, then refreshes **web deployed latest** **once** from **production latest** (not per directory in sort order). No per-id **promotion manifest** check.

## Ledger validation

Explicit `sync <promoted-version>` requires `models/promotions.jsonl` or `models/<id>/promotion.json` in dungeon-runner. `--from-latest` and `--all` are exempt.

## Release smoke (manual)

After sync, before shipping:

1. `npm test` and `npm run lint`
2. `quasar dev` → `/projects/dungeon-runner`
3. Start a match with default NN (`modelId: 'latest'`); confirm turns complete without `MODEL_LOAD_FAILED`
4. Optional: pin an older **deployed model version** in setup and smoke one turn

See also `src/features/dungeon-runner/RELEASE_CHECKLIST.md`.

## Comment-ready summary (dungeon-runner #11 / portfolio-site PR)

After **gated promotion** in dungeon-runner, run **TF.js model sync** from portfolio-site (`npm run sync-dungeon-runner-model -- --from-latest` or explicit semver). That writes **deployed model version** TF.js, regenerates `models.json`, and overwrites **web deployed latest** only when the target is **production latest**. Manual **release smoke** on `/projects/dungeon-runner` with default `modelId: 'latest'`.

## Related

- Cross-repo vocabulary: [`CROSS_REPO.md`](../CROSS_REPO.md)
- Web feature glossary: `src/features/dungeon-runner/CONTEXT.md` (**TF.js model sync**)
- dungeon-runner epic [#11](https://github.com/enmaku/dungeon-runner/issues/11)
- portfolio-site [#127](https://github.com/enmaku/portfolio-site/issues/127) / [#128](https://github.com/enmaku/portfolio-site/issues/128)
