# Game Manager BGG catalog proxy

Server-side BoardGameGeek XML API2 proxy for Game Manager. Keeps the BGG Bearer token off the client.

## Endpoints

Both are HTTPS `onRequest` functions (GET, CORS enabled):

| Function | Query params | Upstream |
| --- | --- | --- |
| `bggSearch` | `query` (required), `type` (default `boardgame`) | `https://boardgamegeek.com/xmlapi2/search` |
| `bggThing` | `id` (required), `stats=1` (default on) | `https://boardgamegeek.com/xmlapi2/thing` |

Responses are JSON with normalized catalog shapes (see `src/features/game-manager/catalog/normalizeBgg.js`).

## Secrets

### Deploy (Secret Manager)

```bash
firebase functions:secrets:set GAME_MANAGER_API_KEY
firebase deploy --only functions
```

The functions bind `GAME_MANAGER_API_KEY` via `defineSecret`; it is injected as `process.env.GAME_MANAGER_API_KEY` at runtime. Do **not** expose this value in Vite `VITE_*` env.

Optional application name (documentation / BGG registration): set `GAME_MANAGER_API_NAME` in your deploy environment if you track it separately—it is not sent to BGG by these handlers.

### Local emulator

1. Copy the repo root `.env.example` to `.env` (or export vars in your shell).
2. Set `GAME_MANAGER_API_KEY` to your BGG application Bearer token.
3. Install function dependencies: `npm install --prefix functions`
4. Start emulators:

```bash
export GAME_MANAGER_API_KEY='your-bgg-bearer-token'
firebase emulators:start --only functions
```

Or place `GAME_MANAGER_API_KEY=...` in `functions/.env` (gitignored) for the Functions emulator.

Point the Quasar app at the emulator base URL, e.g.:

```bash
VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE=http://127.0.0.1:5001/<firebase-project-id>/us-central1
```

If `VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE` is unset, the client falls back to `https://us-central1-<VITE_FIREBASE_PROJECT_ID>.cloudfunctions.net`.

## Rate limiting

Each functions instance serializes upstream BGG calls with ~5 seconds between requests (in-memory). This is not a distributed cache; it reduces burst traffic against BGG limits.

## Normalizer sync

`functions/bgg/normalize.js` duplicates `src/features/game-manager/catalog/normalizeBgg.js`. When changing normalization logic, update both copies; tests run against the `src` module only.

## Catalog attribution

UI surfaces that show BGG metadata must display `CATALOG_ATTRIBUTION` from `src/features/game-manager/catalog/catalogAttribution.js`.
