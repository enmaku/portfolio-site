# Game Manager BGG catalog proxy

Server-side BoardGameGeek access for Game Manager. Keeps the BGG Bearer token off the client.

## Endpoints

Both are HTTPS `onRequest` functions (GET, CORS enabled):

| Function | Query params | Backend |
| --- | --- | --- |
| `bggSearch` | `query` (required); `type` ignored (catalog is base games only) | Firestore `bggCatalogGames` Model A prefix search |
| `bggThing` | `id` (required), `stats=1` (default on) | `https://boardgamegeek.com/xmlapi2/thing` |

Responses are JSON with normalized catalog shapes (see `src/features/game-manager/catalog/normalizeBgg.js`).

Search hits: `{ catalogEntryId, title, yearPublished, type, usersRated, averageRating, bayesAverage, boardGameRank }[]` under `{ results }`. The SPA ranks locally from these fields and does not call `bggThing` during typeahead (thumbnails deferred).

Catalog documents are maintained by local scripts (`npm run bgg-update` / `bgg:ranks:*`).

## Secrets

### Deploy (Secret Manager)

`bggThing` still needs the BGG application token:

```bash
firebase functions:secrets:set GAME_MANAGER_API_KEY
firebase deploy --only functions
```

`bggSearch` uses the Admin SDK against Firestore and does **not** bind `GAME_MANAGER_API_KEY`.

Do **not** expose BGG credentials in Vite `VITE_*` env.

Optional application name (documentation / BGG registration): set `GAME_MANAGER_API_NAME` in your deploy environment if you track it separately—it is not sent to BGG by these handlers.

### Local emulator

1. Copy the repo root `.env.example` to `.env` (or export vars in your shell).
2. Set `GAME_MANAGER_API_KEY` to your BGG application Bearer token (for `bggThing`).
3. Install function dependencies: `npm install --prefix functions`
4. Start emulators (include Firestore if testing catalog search against seeded data):

```bash
export GAME_MANAGER_API_KEY='your-bgg-bearer-token'
firebase emulators:start --only functions,firestore
```

Or place `GAME_MANAGER_API_KEY=...` in `functions/.env` (gitignored) for the Functions emulator.

Point the Quasar app at the emulator base URL, e.g.:

```bash
VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE=http://127.0.0.1:5001/<firebase-project-id>/us-central1
```

If `VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE` is unset, the client falls back to `https://us-central1-<VITE_FIREBASE_PROJECT_ID>.cloudfunctions.net`.

## Rate limiting

`bggThing` serializes upstream BGG calls with ~5 seconds between requests per functions instance (in-memory). This is not a distributed cache; it reduces burst traffic against BGG limits.

## Normalizer sync

`functions/bgg/normalize.js` duplicates `src/features/game-manager/catalog/normalizeBgg.js`. When changing normalization logic, update both copies; tests run against the `src` module only.

Tokenization / stopwords for catalog search live in `functions/bgg/catalogQuery.js` and must stay aligned with `scripts/lib/bggCatalogSearchIndex.mjs`.

## Catalog attribution

UI surfaces that show BGG metadata must display `CATALOG_ATTRIBUTION` from `src/features/game-manager/catalog/catalogAttribution.js`.
