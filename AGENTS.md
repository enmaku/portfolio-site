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

### Environment file (`.env`) vs Cursor Secrets

Quasar/Vite reads **`/workspace/.env`** at dev-server startup (`import.meta.env.VITE_*`). This is separate from **Cursor Secrets** (Environment tab):

| Mechanism | Persists where | Used by Quasar dev? |
| --- | --- | --- |
| **`.env`** (gitignored) | Cloud workspace volume / VM snapshot | **Yes** — preferred for local dev |
| **Cursor Secrets** | Cursor project settings | **No** — not auto-written to `.env`; not visible to Vite unless you materialize them |

**Before debugging Firebase/RTDB as “misconfigured”:**

1. Check whether `/workspace/.env` exists (copy from `.env.example` if missing).
2. Confirm all five `VITE_FIREBASE_*` vars are set for Game Timer / Movie Vote.
3. Restart the dev server after any `.env` edit (`npx quasar dev`). A running server does not hot-reload env changes.
4. Run `npm run check:firebase-rtdb` to probe live RTDB read/write on `gameTimerRooms/`.

**Persistence across agents:** `.env` survives on the same cloud workspace as long as the VM volume is retained. It is **not** in git — fresh environments need `.env` recreated (paste from Cursor Secrets or Firebase Console). Do not commit `.env`.

**Game Timer RTDB errors with secrets “set” but app failing:** usually (a) no `.env` on disk, (b) dev server started before `.env` existed, (c) wrong `VITE_FIREBASE_DATABASE_URL` (must be **Realtime Database**, not Firestore), or (d) `database.rules.json` not deployed (`npx firebase-tools deploy --only database --project <project-id>`).
