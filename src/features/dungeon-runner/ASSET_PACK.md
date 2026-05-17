# Dungeon Runner asset pack

## Contract

- **Runtime PNGs** served from `public/assets/dungeon-runner/runtime/**` and referenced in the app as `/assets/dungeon-runner/runtime/...`.
- **Hires sources** for scaling live under `artifacts/dungeon-runner/hires-pre-scale/` (usually gitignored). The list of inputs and output sizes is `scripts/dungeon-runner-scale-targets.mjs`; run `npm run scale-dungeon-runner-assets` to refresh committed runtime PNGs after painting.
- **URL mapping** for gameplay UI is centralized in `src/features/dungeon-runner/ui/assetPack.js`. Equipment tokens on the bidding board share one **runtime-only** PNG (`equipment/plate.png`): there is no per-equipment-id row in the pack; labels and affordances come from `data/gameDataCatalog.js` (equipment **ui** fields) and `dungeonEquipmentInteractions.js`, not from distinct bitmaps per id.
- **Card grammar layers** (blank card, per-species doodles, defeat symbols) are **intentionally not** entries on `dungeonRunnerAssetPack`. They are composed by `MonsterCardFace.vue` from URLs built in `ui/monsterCardSpec.js`, using the same runtime root as the pack (`DUNGEON_RUNNER_RUNTIME_BASE` in `assetPack.js`). That keeps the pack table focused on discrete “whole” assets while card faces stay aligned with monster rows in `gameDataCatalog.js` (`listMonsterCardSpecs` / neutralization icon keys) and layered layout. Swapping grammar art means replacing files under `runtime/cards/` and `runtime/symbols/` (or the matching hires paths, then re-running the scale script). Adding a species or symbol updates `gameDataCatalog.js`, `monsterCardSpec.js` URL helpers, and `dungeon-runner-scale-targets.mjs`.

## Swap an asset without editing Vue

1. For assets covered by the scale script: replace the hires PNG under `artifacts/dungeon-runner/hires-pre-scale/<path>` as listed in `dungeon-runner-scale-targets.mjs`, then run `npm run scale-dungeon-runner-assets`.
2. For assets **not** in that list (for example pile backs or the flat revealed-monster reference): edit the committed file under `public/assets/dungeon-runner/runtime/...` directly, or add a new row to `dungeon-runner-scale-targets.mjs` and a matching hires file, then run the scale script.
3. If you add a **new** logical asset, extend `assetPack.js` and (when using hires) `dungeon-runner-scale-targets.mjs`, then adjust Vue only if you introduce a **new screen region** that must display it.

## Scripts

| Command | Role |
| --- | --- |
| `npm run scale-dungeon-runner-assets` | Hires PNG in `artifacts/dungeon-runner/hires-pre-scale` → runtime (per `dungeon-runner-scale-targets.mjs`). |

### Hires scale targets (equipment + symbols + card grammar subset)

Target list lives in `scripts/dungeon-runner-scale-targets.mjs` (also imported by the scale script). After painting hires, drop files under `artifacts/dungeon-runner/hires-pre-scale/` using the paths in that module, then run `npm run scale-dungeon-runner-assets`. **Plate token (hires):** canonical path is `hires-pre-scale/tokens/plate.png` (#79 slice 05); `hires-pre-scale/equipment/plate.png` is still accepted if present.

| Hires input (under `hires-pre-scale/`) | Runtime output | Size | Strip profile |
| --- | --- | --- | --- |
| `tokens/plate.png` or `equipment/plate.png` (alternate) | `public/.../runtime/equipment/plate.png` | 256×256 | `strip-neutral-card` (same kraft-oriented margin strip as `cards/card-blank.png`; larger than symbols so cardboard edge detail survives in the small on-board token) |
| `symbols/<key>.png` for keys including `torch`, `chalice`, `armor`, `shield`, `potion`, `vorpal`, `ring`, `axe`, `poly`, `omni`, … | `public/.../runtime/symbols/<key>.png` | 128×128 | `strip-neutral-light` |

The repo **commits** runtime PNGs under `public/assets/dungeon-runner/runtime/**` so CI and the app work without local hires (`npm test` checks those paths). Hires inputs live under `artifacts/dungeon-runner/hires-pre-scale/` (that tree is gitignored); after adding or replacing hires there, run `npm run scale-dungeon-runner-assets` to refresh runtime PNGs. If a hires file is missing, the scale script exits non-zero and lists paths. Until hires exist for a key, keep a committed placeholder in `public/.../runtime/**` so tests stay green.

**GitHub #79 / slice 05:** committed runtime PNGs for the token plate and new symbol keys may remain **interim** until painted hires land; `equipmentTokenAppearance.test.js` asserts paths and decodable images, not art direction. For local scale pipeline checks only, run `npm run seed-dungeon-runner-placeholder-hires` to drop low-fidelity hires for the plate and the eight new equipment symbol keys under `hires-pre-scale/` (still not final art).

## Tests

- `src/features/dungeon-runner/dungeonRunnerScaleTargets.test.js` — scale job lists plate (256²) + symbol keys (128², strip modes); doodle and card-symbol coverage stays aligned with `listMonsterCardSpecs()` from the game data catalog.
- `src/features/dungeon-runner/equipmentTokenAppearance.test.js` — each symbol key used on equipment tokens has a runtime PNG path on disk.
- `src/features/dungeon-runner/ui/assetPack.test.js` — every `dungeonRunnerAssetPack` entry has a runtime PNG on disk.
- `src/features/dungeon-runner/ui/monsterCardSpec.test.js` — grammar runtime PNG paths exist and back/revealed template URLs match the pack.
