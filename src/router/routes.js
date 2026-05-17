import { SITE_NAME } from '../share-metadata.js'

/**
 * Default `document.title` when no share catalog row matches the route path.
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
      },
      {
        path: 'about',
        component: () => import('pages/AboutPage.vue'),
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
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
