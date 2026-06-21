/**
 * Single source of truth for shareable HTML metadata.
 *
 * Consumed by:
 * - the Vue router (browser tab titles + client-side OG tag sync)
 * - `scripts/generate-share-pages.mjs` (build-time per-route HTML copies so
 *   link previews on Discord/Slack/etc. see correct titles even though the
 *   site is a hash-routed SPA)
 */

export const SITE_NAME = 'David J. Perry'
export const SHARE_SITE_NAME = 'Focus Disorder'
export const PUBLIC_SITE_ORIGIN = 'https://focusdisorder.com'

const DEFAULT_OG_IMAGE = 'icons/favicon-default.svg'

/**
 * @typedef {object} ShareCatalogEntry
 * @property {string} routePath       Router path (no hash, no publicPath).
 * @property {boolean} pasteUnfurl    Whether paste/link unfurl uses generated HTML for this route.
 * @property {string} shareSlug       Directory slug under dist/spa (empty = root index only).
 * @property {string} title           Browser tab title AND preview title.
 * @property {string} description     Preview description.
 * @property {string} ogImage         Path (relative to publicPath) to an OG image.
 * @property {string} favicon         Favicon id used by route document chrome.
 */

/** @type {ShareCatalogEntry[]} */
export const SHARE_CATALOG = [
  {
    routePath: '/',
    pasteUnfurl: true,
    shareSlug: '',
    title: SITE_NAME,
    description: 'Portfolio site for David J. Perry — photography, writing, and small web apps.',
    ogImage: DEFAULT_OG_IMAGE,
    favicon: 'photo',
  },
  {
    routePath: '/about',
    pasteUnfurl: true,
    shareSlug: 'about',
    title: `About — ${SITE_NAME}`,
    description: 'About David J. Perry.',
    ogImage: 'icons/favicon-info.svg',
    favicon: 'info',
  },
  {
    routePath: '/projects/game-timer',
    pasteUnfurl: true,
    shareSlug: 'projects/game-timer',
    title: 'Game Timer',
    description:
      'Shared multiplayer countdown timers for tabletop games. Host a room, share the code, keep everyone in sync.',
    ogImage: 'icons/social/game-timer.png',
    favicon: 'timer',
  },
  {
    routePath: '/projects/movie-vote',
    pasteUnfurl: true,
    shareSlug: 'projects/movie-vote',
    title: 'Movie Vote',
    description:
      'Collaboratively pick a movie with friends. Nominate titles, rank your favorites, and let instant-runoff voting decide.',
    ogImage: 'icons/social/movie-vote.png',
    favicon: 'movie',
  },
  {
    routePath: '/projects/dungeon-runner',
    pasteUnfurl: true,
    shareSlug: 'projects/dungeon-runner',
    title: 'Dungeon Runner',
    description:
      'Play Welcome to the Dungeon against configurable AI opponents with deterministic browser-only simulation.',
    ogImage: 'icons/favicon-shield.svg',
    favicon: 'shield',
  },
  {
    routePath: '/projects/dungeon-runner/stats',
    pasteUnfurl: true,
    shareSlug: 'projects/dungeon-runner/stats',
    title: 'Dungeon Runner Stats',
    description:
      'Aggregate statistics from completed Dungeon Runner matches — wins, eliminations, and opponent outcomes.',
    ogImage: 'icons/favicon-bar_chart.svg',
    favicon: 'bar_chart',
  },
  {
    routePath: '/projects/world-builder',
    pasteUnfurl: true,
    shareSlug: 'projects/world-builder',
    title: 'World Builder',
    description:
      'Procedural fantasy world geography — explore generated landmasses with biome-colored maps.',
    ogImage: 'icons/favicon-default.svg',
    favicon: 'public',
  },
]

/** @type {Map<string, ShareCatalogEntry>} */
const shareEntryByPath = new Map(SHARE_CATALOG.map((entry) => [entry.routePath, entry]))

/**
 * @param {string} path Router path (no hash, no publicPath).
 * @returns {ShareCatalogEntry | null}
 */
export function getShareEntryForPath(path) {
  return shareEntryByPath.get(path) ?? null
}

/** Subfolder paste-unfurl HTML (excludes home — root `index.html` only). */
export const PASTE_UNFURL_ROUTES = SHARE_CATALOG.filter(
  (entry) => entry.pasteUnfurl && entry.shareSlug !== '',
)

/** Unique favicon ids referenced by the catalog. */
export const FAVICON_IDS = [...new Set(SHARE_CATALOG.map((entry) => entry.favicon))]
