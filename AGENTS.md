# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

Single-package Vue 3 / Quasar 2 SPA (`portfolio-site`). No custom backend — Firebase RTDB/Firestore from the browser for multiplayer projects. See [README.md](README.md) and [CONTEXT-MAP.md](CONTEXT-MAP.md).

### Services

| Service | Command | URL | Notes |
| --- | --- | --- | --- |
| Dev server (required) | `npx quasar dev` or `npm run dev` | `http://localhost:9000/#/` | **Use the hash URL** (`/#/`, `/#/about`, …). Router is hash mode; opening bare `http://localhost:9000/` can show a blank page in the Desktop browser. |
| Dev (slow FS / VMs) | `npm run dev:poll` | same | Enables Chokidar polling; equivalent to `quasar dev` with `CHOKIDAR_USEPOLLING=1`. |

Only the Quasar dev server is required for gallery/about and most local dev. Firebase and TMDB env vars are optional unless testing those features (see `.env.example`).

### Git LFS (gallery photos)

Gallery source images under `src/assets/photos/*.jpg` are Git LFS objects. Cloud VMs often set `GIT_LFS_SKIP_SMUDGE=1`, so clones leave tiny pointer files until LFS is pulled explicitly:

```bash
git lfs pull
```

Verify with `file src/assets/photos/10010.jpg` — should report `JPEG image data`, not `ASCII text`. Thumbnails for dev/build: `npm run generate-thumbs` (also runs in `prebuild`).

### Lint / test / build

Standard commands from [README.md](README.md):

- `npm run lint`
- `npm test`
- `npm run build` → `dist/spa`

Firebase rules tests (`npm run test:database-rules`, `test:firestore-rules`) need the Firebase CLI and emulators; not required for routine app dev.

### Environment file

Copy `.env.example` → `.env` only when testing Movie Vote, Game Timer, or Firebase-backed Dungeon Runner flows. Restart the dev server after changes.
