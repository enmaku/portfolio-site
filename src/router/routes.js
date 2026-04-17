/**
 * Default `document.title` when a route omits `meta.title`.
 * @type {string}
 */
export const portfolioDocumentTitle = 'David J. Perry'

/** @type {import('vue-router').RouteRecordRaw[]} */
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/IndexPage.vue'),
        meta: { title: portfolioDocumentTitle, favicon: 'photo' },
      },
      {
        path: 'about',
        component: () => import('pages/AboutPage.vue'),
        meta: { title: portfolioDocumentTitle, favicon: 'info' },
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
        meta: { title: 'Game Timer', favicon: 'timer' },
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
        meta: { title: 'Movie Vote', favicon: 'movie' },
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
