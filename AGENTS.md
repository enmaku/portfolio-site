# AGENTS.md

## Cursor Cloud specific instructions

This is a **Vue 3 / Quasar Framework SPA** (portfolio site with photography gallery, Game Timer, and Movie Vote features). There is no backend server or database — it is entirely client-side.

### Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npx quasar dev` (serves at `http://localhost:9000/`) |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Unit tests | `npm test` |
| Build | `npm run build` (runs `prebuild` → thumbnail generation first) |

### Caveats

- **Photo assets use Git LFS.** Without LFS checkout the files are ~132-byte pointer stubs and the photography gallery shows blank. The app still functions; only images are missing.
- **TMDB API keys are optional.** Movie Vote movie search requires `VITE_TMDB_READ_ACCESS_TOKEN` or `VITE_TMDB_API_KEY` in a `.env` file (see `.env.example`). Without them the rest of the app works fine.
- **`npm run build` requires Sharp** to generate photo thumbnails via `prebuild`. The dev server (`quasar dev`) does **not** need thumbnails and starts fine without them.
- **Package manager:** Use `npm` — the lockfile is `package-lock.json`. `pnpm` and `yarn` are listed in engines but not actively used.
- **`postinstall` runs `quasar prepare`** automatically after `npm install`, which generates `.quasar/` typings needed for linting and IDE support.
