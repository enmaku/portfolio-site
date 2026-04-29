import { SHARE_METADATA, SITE_NAME } from '../share-metadata.js'

/**
 * Default `document.title` when a route omits `meta.title`.
 * @type {string}
 */
export const portfolioDocumentTitle = SITE_NAME

/** @type {import('vue-router').RouteRecordRaw[]} */
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/IndexPage.vue'),
        meta: {
          title: SHARE_METADATA.root.title,
          favicon: SHARE_METADATA.root.favicon,
          shareKey: 'root',
        },
      },
      {
        path: 'about',
        component: () => import('pages/AboutPage.vue'),
        meta: {
          title: SHARE_METADATA.about.title,
          favicon: SHARE_METADATA.about.favicon,
          shareKey: 'about',
        },
      },
    ],
  },
  {
    path: '/projects/game-timer',
    component: () => import('layouts/projects/GameTimerLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/projects/GameTimerPage.vue'),
        meta: {
          title: SHARE_METADATA.gameTimer.title,
          favicon: SHARE_METADATA.gameTimer.favicon,
          shareKey: 'gameTimer',
        },
      },
    ],
  },
  {
    path: '/projects/movie-vote',
    component: () => import('layouts/projects/MovieVoteLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/projects/MovieVotePage.vue'),
        meta: {
          title: SHARE_METADATA.movieVote.title,
          favicon: SHARE_METADATA.movieVote.favicon,
          shareKey: 'movieVote',
        },
      },
    ],
  },
  {
    path: '/projects/dungeon-runner',
    component: () => import('layouts/projects/DungeonRunnerLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/projects/DungeonRunnerPage.vue'),
        meta: {
          title: SHARE_METADATA.dungeonRunner.title,
          favicon: SHARE_METADATA.dungeonRunner.favicon,
          shareKey: 'dungeonRunner',
        },
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
    meta: { title: portfolioDocumentTitle, favicon: 'default' },
  },
]

export default routes
