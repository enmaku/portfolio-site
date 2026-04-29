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

const DEFAULT_OG_IMAGE = 'icons/favicon-default.svg'

/**
 * @typedef {object} ShareMetadata
 * @property {string} title           Browser tab title AND preview title.
 * @property {string} description     Preview description.
 * @property {string} routePath       Router path (no hash, no publicPath).
 * @property {string} shareSlug       Directory slug under dist/spa for the generated HTML (empty = root).
 * @property {string} ogImage         Path (relative to publicPath) to an OG image.
 * @property {string} favicon         Favicon id used by applyRouteFavicon.
 */

/** @type {Record<string, ShareMetadata>} */
export const SHARE_METADATA = {
  root: {
    title: SITE_NAME,
    description: 'Portfolio site for David J. Perry — photography, writing, and small web apps.',
    routePath: '/',
    shareSlug: '',
    ogImage: DEFAULT_OG_IMAGE,
    favicon: 'photo',
  },
  about: {
    title: `About — ${SITE_NAME}`,
    description: 'About David J. Perry.',
    routePath: '/about',
    shareSlug: 'about',
    ogImage: 'icons/favicon-info.svg',
    favicon: 'info',
  },
  gameTimer: {
    title: 'Game Timer',
    description:
      'Shared multiplayer countdown timers for tabletop games. Host a room, share the code, keep everyone in sync.',
    routePath: '/projects/game-timer',
    shareSlug: 'projects/game-timer',
    ogImage: 'icons/favicon-timer.svg',
    favicon: 'timer',
  },
  movieVote: {
    title: 'Movie Vote',
    description:
      'Collaboratively pick a movie with friends. Nominate titles, rank your favorites, and let instant-runoff voting decide.',
    routePath: '/projects/movie-vote',
    shareSlug: 'projects/movie-vote',
    ogImage: 'icons/favicon-movie.svg',
    favicon: 'movie',
  },
  dungeonRunner: {
    title: 'Dungeon Runner',
    description:
      'Play Welcome to the Dungeon against configurable AI opponents with deterministic browser-only simulation.',
    routePath: '/projects/dungeon-runner',
    shareSlug: 'projects/dungeon-runner',
    ogImage: DEFAULT_OG_IMAGE,
    favicon: 'default',
  },
}

/** Ordered list of routes that should get their own generated preview HTML. */
export const SHAREABLE_ROUTES = [
  SHARE_METADATA.gameTimer,
  SHARE_METADATA.movieVote,
  SHARE_METADATA.dungeonRunner,
  SHARE_METADATA.about,
]
