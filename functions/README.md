# Game Manager BGG catalog proxy

Server-side BoardGameGeek access for Game Manager. Keeps the BGG Bearer token off the client.

## Endpoints

HTTPS `onRequest` functions (GET, CORS enabled):

| Function | Params | Backend |
| --- | --- | --- |
| `bggSearch` | `query` (required); `type` ignored (catalog is base games only) | Firestore `bggCatalogGames` Model A prefix search |
| `bggThing` | `id` (required), `stats` accepted (ignored for upstream) | Firestore `bggThingCache` (24h TTL), then `/thing?stats=1` on miss/expiry |
| `bggThumb` | path `/{id}` or query `id` | Firestore cache on `bggCatalogGames`, then minimal `/thing` (no stats) write-back |

Responses are JSON with normalized catalog shapes (see `src/features/game-manager/catalog/normalizeBgg.js`).

Search hits: `{ catalogEntryId, title, yearPublished, type, usersRated, averageRating, bayesAverage, boardGameRank }[]` under `{ results }`. The SPA ranks locally from these fields and does not call `bggThing` during typeahead (thumbnails deferred).

`bggThing` response: `{ entry, entries }` (same normalized thing shape). Cache-first against `bggThingCache/{id}` with `entry` + `cachedAtMs`. Fresh docs (under 24h) skip BGG entirely and therefore skip the ~5s upstream limiter. Misses/expired ids are fetched once with `stats=1`, then batch-written; expired docs are overwritten, not deleted. Cap remains 20 ids per request.

`bggThumb` response: `{ results: [{ catalogEntryId, thumbnailUrl, source }] }` where `source` is `cache`, `bgg`, or `missing`. Accepts comma-separated `id` values (max 40). One `getAll` against Firestore, then `/thing` in chunks of 20 (no stats) only for cache misses; write-back is a single batch merge of `thumbnailUrl` onto existing docs. Use `bggThing` for full catalog detail. TTL eviction is deferred.

Catalog documents are maintained by local scripts (`npm run bgg-update` / `bgg:ranks:*`).

## Secrets

### Deploy (Secret Manager)

`bggThing` and `bggThumb` need the BGG application token:

```bash
firebase functions:secrets:set GAME_MANAGER_API_KEY
firebase deploy --only functions
```

`bggSearch` uses the Admin SDK against Firestore and does **not** bind `GAME_MANAGER_API_KEY`.
`bggThumb` binds the secret only for cache-miss upstream fetches; cache hits never call BGG.

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

`bggThing` / `bggThumb` serialize upstream BGG calls with ~5 seconds between requests per functions instance (in-memory). This is not a distributed cache; it reduces burst traffic against BGG limits. Cached `bggThing` and `bggThumb` hits skip the limiter entirely.

## Normalizer sync

`functions/bgg/normalize.js` duplicates `src/features/game-manager/catalog/normalizeBgg.js`. When changing normalization logic, update both copies; tests run against the `src` module only.

Tokenization / stopwords for catalog search live in `functions/bgg/catalogQuery.js` and must stay aligned with `scripts/lib/bggCatalogSearchIndex.mjs`.

## Catalog attribution

UI surfaces that show BGG metadata must display `CATALOG_ATTRIBUTION` from `src/features/game-manager/catalog/catalogAttribution.js`.
