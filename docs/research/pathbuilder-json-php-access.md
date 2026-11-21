# Can a browser on another origin read Pathbuilder `json.php`?

Research for issue #477 (map #476). Facts only; no architecture decision.
Probed 2026-11-21 against `https://pathbuilder2e.com/json.php?id=264031` (the Lithrei Woeborn build).

## Short answer

Yes. From a page on a different origin (`https://example.com`), a plain `fetch()` of
`json.php?id=N` returned 200 with `Access-Control-Allow-Origin: *` and a readable JSON body,
with no Cloudflare challenge. This worked in a fresh isolated Chrome context (no cookies, so no
prior `cf_clearance`) and in a normal profile. Non-browser clients (curl, even with a Chrome
User-Agent) get a Cloudflare 403 challenge.

## Evidence

### Browser, cross-origin (Chrome 157, macOS, DevTools-driven)

Page origin `https://example.com`, `fetch('https://pathbuilder2e.com/json.php?id=264031')`:

- Status 200, `response.type === "cors"`, body readable via `.json()` / `.text()`.
- Request headers sent by the browser: `origin: https://example.com`, `sec-fetch-mode: cors`,
  `sec-fetch-site: cross-site`, `accept: */*`.
- Response headers:
  - `access-control-allow-origin: *`
  - `access-control-allow-methods: GET, OPTIONS`
  - `access-control-allow-headers: Origin, Content-Type, X-Auth-Token`
  - `content-type: application/json; charset=utf-8`
  - `cache-control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0`
  - `pragma: no-cache`, `expires: Sat, 26 Jul 1997 05:00:00 GMT`, `cf-cache-status: DYNAMIC`
  - `last-modified` equals the current time (dynamic page, not a real validator)
  - `content-encoding: br`, `server: cloudflare`
- Repeated in an isolated browser context (empty cookie jar): same 200 result. Cloudflare did
  not challenge the browser request on this path.
- Same request from a normal (cookied) profile: 200, `type: cors`.

### Preflight

- A request with a non-safelisted header (`X-Foo: 1`) triggers `OPTIONS`; the server answers
  204 with the same `access-control-allow-*` headers. `X-Foo` is not in `allow-headers`, so the
  browser rejected the actual request (`TypeError: Failed to fetch`).
- A simple GET with no custom headers needs no preflight. Allowed custom headers are only
  `Origin, Content-Type, X-Auth-Token`.
- `access-control-allow-origin` is `*`, so credentialed requests (`credentials: 'include'`)
  cannot be used; plain requests do not need them.
- Only CORS-safelisted response headers are readable by page JS (e.g. `content-type`,
  `cache-control`); no `access-control-expose-headers` was observed.

### Non-browser clients

- `curl` (default UA), `curl -A 'Mozilla/5.0'`, and `curl` with a full Chrome 157 UA plus an
  `Origin` header all got HTTP 403 with `cf-mitigated: challenge` and a "Just a moment..." HTML
  page (managed challenge). Same for `launch.html?build=N`, and for a nonexistent id (the
  challenge fires before the app can answer 404).
- So Cloudflare distinguishes scripted clients from real browsers on this path (bot/TLS
  fingerprinting is the likely mechanism; not confirmed from Cloudflare's side). Anything
  server-side (PHP, Node, Cloud Functions) fetching this URL should expect the challenge.

### Response shape

- Success: `{"success":true,"build":{...}}`. The live `build` keys are
  `name, class, dualClass, level, xp, ancestry, heritage, background, alignment, gender, age,
  deity, size, sizeName, keyability, languages, rituals, resistances, inventorMods, abilities,
  attributes, proficiencies, mods, feats, specials, lores, equipmentContainers, equipment,
  specificProficiencies, weapons, money, armor, spellCasters, focusPoints, focus, formula,
  acTotal, pets, familiars`.
- The SoT file `~/code/strength-of-thousands/heroes/lithrei-woeborn.json` has top-level keys
  `pathbuilderId, displayName, tagline, bio, build, relationships, study`. Its `build` object has
  exactly the same key list as the live `build`. SoT stores only the inner `build` (it strips the
  `{success, build}` envelope via `extractBuildFromResponse`) inside its own hero wrapper. The live
  envelope is `{success, build}`, matching `pathbuilder-records/docs/08-export-and-integrations.md`
  section 3.1.
- Not found: `GET json.php?id=999999999` from a browser returned HTTP **404** with body
  `{"success":false,"error":"Build not found."}` (readable cross-origin). The status is 404, so
  `res.ok` is false.
- Private/deleted builds, malformed ids and rate-limit responses were not probed.

### Caching

Responses are explicitly uncacheable (`no-store, no-cache, must-revalidate, max-age=0`,
`Expires` in 1997, `Pragma: no-cache`) and Cloudflare reports `DYNAMIC` (not cached at the
edge). The browser HTTP cache will not reuse them; any caching must be done by the consumer.

## Third-party use, rate limits, terms

- `https://pathbuilder2e.com/robots.txt` (Cloudflare-managed content block): `User-agent: *` with
  `Content-Signal: search=yes,ai-train=no,use=reference` and `Allow: /`; named AI-training crawlers
  (ClaudeBot, GPTBot, CCBot, Google-Extended, etc.) are `Disallow: /`. The comment block frames
  content signals as conditions of access and an EU Art. 4 rights reservation. It is generic
  Cloudflare managed text, not a statement about `json.php`.
- No published Pathbuilder API, rate limit or terms: `pathbuilder-records/docs/11-legal-and-licensing.md`
  records no ToS/EULA and `terms.html` returning 404 (earlier research in this repo; not
  re-verified today). `pathbuilder-records/docs/08-export-and-integrations.md` says Pathbuilder has
  no public API.
- Rate limits are not documented anywhere found. Cloudflare may apply its own; not probed (no load
  testing was done).
- `json.php?id=N` vs `launch.html?build=N` (per docs/08): `launch.html?build=N` is the human
  share-link landing page (also challenged for curl); `json.php?id=N` is the server-side JSON
  export view and is the one with open CORS. Share returns a numeric id (`emailedBuildID`);
  `shareCode` is read-only and `editToken` is write access (docs/08 section 5). Whether
  `launch.html?build=N` and `json.php?id=N` share one id space was not tested beyond id 264031.
- `json.php` needs no auth token. Ids are small sequential integers (264031 here), so any
  existing id is readable by anyone (matches the map's privacy note).

## How Strength of Thousands fetches today

`~/code/strength-of-thousands/src/domain/pathbuilder.js`:

- `parsePathbuilderId(input)` accepts a bare integer or a URL with an `id` query param.
- `pathbuilderJsonUrl(id)` returns `https://pathbuilder2e.com/json.php?id=${id}`.
- `fetchPathbuilderBuild(id)` does a bare `fetch(url)` (no headers or options). A network failure
  becomes "Could not reach PathBuilder - check your network or open pathbuilder2e.com in this
  browser and retry"; `!res.ok` becomes "PathBuilder is unavailable"; then `res.json()` and
  `extractBuildFromResponse` (requires `success === true` and `build`).
- It runs **in the browser**: it is called from `src/composables/useHeroRoster.js` (`importHero`,
  `refreshHero`, GM mode only; surfaced in `src/pages/HeroesPage.vue`). The composable then POSTs
  `{pathbuilderId, build}` to same-origin `/api/heroes`, implemented by the Vite dev plugin
  `scripts/campaign-dev-plugin.mjs`, which writes `heroes/*.json`. Nothing server-side contacts
  Pathbuilder; the server receives the already-fetched build. This is consistent with the
  probe (browser works, scripts get the challenge).
- A missing build gives `res.ok === false`, so SoT shows the generic "PathBuilder is unavailable"
  rather than "Build not found".

## Limits of this probe

- One real id (264031) and one nonexistent id, from one Chrome version and one IP. Cloudflare's
  decision may vary by IP reputation, fingerprint or volume; an unusual browser or embedded
  webview might be challenged.
- Safari and Firefox not tested (the CORS headers are standard, so expected to behave the same).
- Only an `https` page origin was tested, not `http://localhost`.
- Cloudflare behaviour is the site operator's setting and can change without notice.
