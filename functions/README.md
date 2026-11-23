# Cloud Functions

Two groups of functions live here: the Game Manager BGG catalog proxy (below) and the CritCrafter sheet builder (`critcrafterSheet`, at the end of this file).

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

Search hits: `{ catalogEntryId, title, yearPublished, type, usersRated, averageRating, bayesAverage, boardGameRank, thumbnailUrl }[]` under `{ results }`. The SPA ranks locally from these fields. Typeahead uses `thumbnailUrl` from the hit (no extra `bggThumb` call). First query token must be at least 2 characters; later tokens may be 1 character. Firestore lookup is unbounded (no candidate cap); results are capped at 20. Missing `thumbnailUrl`s on that page are filled with one BGG `/thing` batch (no stats) and merged onto catalog docs before the response; hits that already have a URL skip BGG.

`bggThing` response: `{ entry, entries }` (same normalized thing shape). Cache-first against `bggThingCache/{id}` with `entry` + `cachedAtMs`. Fresh docs (under 24h) skip BGG entirely. Misses/expired ids are fetched once with `stats=1`, then batch-written; expired docs are overwritten, not deleted. Cap remains 20 ids per request.

`bggThumb` response: `{ results: [{ catalogEntryId, thumbnailUrl, source }] }` where `source` is `cache`, `thing_cache`, `bgg`, or `missing`. Accepts comma-separated `id` values (max 40). One `getAll` against Firestore catalog docs plus `bggThingCache`, then `/thing` in chunks of 20 (no stats) only for remaining misses; write-back is a single batch merge of `thumbnailUrl` onto existing catalog docs. Use `bggThing` for full catalog detail.

Catalog documents are maintained by local scripts (`npm run bgg-update` / `bgg:ranks:*`).

## Secrets

### Deploy (Secret Manager)

`bggSearch`, `bggThing`, and `bggThumb` need the BGG application token:

```bash
firebase functions:secrets:set GAME_MANAGER_API_KEY
firebase deploy --only functions
```

`bggSearch` binds `GAME_MANAGER_API_KEY` only to fill missing thumbnails on the 20 returned hits; catalog docs that already have `thumbnailUrl` never call BGG.
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

## Normalizer sync

`functions/bgg/normalize.js` duplicates `src/features/game-manager/catalog/normalizeBgg.js`. When changing normalization logic, update both copies; tests run against the `src` module only.

Tokenization / stopwords for catalog search live in `functions/bgg/catalogQuery.js` and must stay aligned with `scripts/lib/bggCatalogSearchIndex.mjs`.

## Catalog attribution

UI surfaces that show BGG metadata must display `CATALOG_ATTRIBUTION` from `src/features/game-manager/catalog/catalogAttribution.js`.

# CritCrafter: `critcrafterSheet`

`onRequest` function (`us-central1`, 512 MiB, `minInstances: 0`, `maxInstances: 10`, 30 s, `cors: true`) that turns a Pathbuilder export into the CritCrafter sheet. Contract: [docs/critcrafter/SPEC.md](../docs/critcrafter/SPEC.md) and [docs/critcrafter/sheet.schema.json](../docs/critcrafter/sheet.schema.json); operations: [docs/critcrafter/runbook.md](../docs/critcrafter/runbook.md).

- `POST` the `json.php` response body verbatim (`{ "success": true, "build": { ... } }`). Success is `200` with the sheet.
- Errors are `{ "error": { "code", "message" } }`: `405 method_not_allowed`, `401 app_check_failed`, `400 bad_json`, `413 too_large` (1 MB, on `Content-Length` and the parsed body), `422 invalid_build` (missing or non-object `build`), `500 internal` (including a sheet over 2 MB); `rate_limited` is reserved. `app_check_failed` (listed in the SPEC) is logged at `warn` like every 4xx (5xx log at `error`): `enforceAppCheck` is a callable-only option, so the handler verifies the `X-Firebase-AppCheck` token itself (skipped inside the Functions emulator). Note that the platform's own body parser rejects malformed JSON sent as `application/json` with a plain 400 before the handler runs, so `bad_json` is only seen for other content types; the viewer treats every non-2xx the same.
- Names resolve against the Firestore `rulesEntries` corpus (Admin SDK): exact `nameKey`, then alias, then miss. Lookups are batched (30 keys per query) into a bounded in-memory cache that lives as long as the warm instance.
- Code: `critcrafter/handler.js` (HTTP boundary and logging), `resolve.js` (resolution, scroll and wand), `assemble.js` (sheet assembly), `derived/` (derived stats), `store.js` (Firestore), `index.js` (wiring). `nameKey.js` must stay identical to `nameKey()` in `scripts/critcrafter-ingest-lib.mjs` (a test checks).
- Logs: one structured entry per request with request id, byte counts, duration, corpus SHA and warning code counts only (never the body, names or warning detail).

## Emulator run

```bash
firebase emulators:start --only functions,firestore --project demo-critcrafter
# in another terminal: load a corpus, then post an export
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 VITE_FIREBASE_PROJECT_ID=demo-critcrafter \
  npm run critcrafter:ingest -- --packs ~/code/foundry-pf2e --sha <sha> --apply
curl -s -X POST -H 'content-type: application/json' \
  --data-binary @docs/critcrafter/fixtures/pathbuilder-exports/anya.json \
  http://127.0.0.1:5001/demo-critcrafter/us-central1/critcrafterSheet
```

A demo project id keeps everything local. The same corpus feeds `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 VITE_FIREBASE_PROJECT_ID=demo-critcrafter npm run critcrafter:regen-fixtures`. Registering the App Check key and deploying are separate (#505).
