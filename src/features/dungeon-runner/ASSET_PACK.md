# Dungeon Runner asset pack

## Contract

- **Runtime PNGs** served from `public/assets/dungeon-runner/runtime/**` and referenced in the app as `/assets/dungeon-runner/runtime/...`.
- **Editable SVG masters** live in `public/assets/dungeon-runner/masters/**` and are the source of truth for regenerating PNGs in-repo.
- **URL mapping** for gameplay UI is centralized in `src/features/dungeon-runner/ui/assetPack.js` (including per-equipment icons derived from `EQUIPMENT_IDS` in `engine/kernel.js`).
- **Card grammar layers** (blank card, per-species doodles, defeat symbols) are **intentionally not** entries on `dungeonRunnerAssetPack`. They are composed by `MonsterCardFace.vue` from URLs built in `ui/monsterCardSpec.js`, using the same runtime root as the pack (`DUNGEON_RUNNER_RUNTIME_BASE` in `assetPack.js`). That keeps the pack table focused on discrete “whole” assets while card faces stay aligned with `MONSTER_CARD_SPECS` and layered layout. Swapping grammar art still means replacing files under `runtime/cards/` and `runtime/symbols/` (and masters under `masters/cards/doodles`, `masters/symbols`) without Vue changes; adding a species or symbol updates `monsterCardSpec.js` / `MONSTER_CARD_SPECS` and the raster job list via `rasterizeGrammarJobRels.js`.

## Swap an asset without editing Vue

1. Replace the SVG under `public/assets/dungeon-runner/masters/<group>/<name>.svg`, **or** drop in a new PNG at the matching path under `public/assets/dungeon-runner/runtime/<group>/<name>.png` if you are not using the SVG pipeline for that file.
2. If you changed an SVG, regenerate runtime PNGs: `npm run rasterize-dungeon-runner-masters`.
3. If you add a **new** logical asset, extend `assetPack.js` (and `generate-dungeon-runner-master-svgs.mjs` / `rasterize-dungeon-runner-masters.mjs` when using masters), then adjust Vue only if you introduce a **new screen region** that must display it.

## Scripts

| Command | Role |
| --- | --- |
| `npm run generate-dungeon-runner-master-svgs` | Rewrites placeholder SVG masters (prototype shapes). |
| `npm run rasterize-dungeon-runner-masters` | SVG → runtime PNG via `sharp`. |
| `npm run scale-dungeon-runner-assets` | Optional: hires PNG in `artifacts/dungeon-runner/hires-pre-scale` → runtime (ignored by git). Use for paint-over workflows; masters path above is the tracked default. |

## Tests

- `src/features/dungeon-runner/ui/assetPack.test.js` — every `dungeonRunnerAssetPack` entry has a runtime PNG and master SVG on disk.
- `src/features/dungeon-runner/ui/monsterCardSpec.test.js` — grammar runtime PNG paths exist and back/revealed template URLs match the pack.
- `src/features/dungeon-runner/ui/rasterizeGrammarJobRels.test.js` — rasterize grammar jobs are derived from `MONSTER_CARD_SPECS` (species + defeat symbol keys) and the rasterize script imports that module (contract against hardcoded species/symbol lists).
