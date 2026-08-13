import assert from 'node:assert/strict'
import test from 'node:test'
import routes from '../../../router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../../../share-metadata.js'

const STATS_PATH = '/projects/dungeon-runner/stats'

test('dungeon runner stats route is a MainLayout child', () => {
  const mainLayout = routes.find((entry) => entry.path === '/')
  assert.ok(mainLayout)
  const statsRoute = mainLayout.children?.find((child) => child.path === 'projects/dungeon-runner/stats')
  assert.ok(statsRoute)
  const component = String(statsRoute.component)
  assert.match(component, /DungeonRunnerStatsPage\.vue/)
})

test('dungeon runner stats route is not under ProjectShellLayout', () => {
  const playRoute = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(playRoute)
  assert.match(String(playRoute.component), /ProjectShellLayout/)
  const statsUnderPlay = playRoute.children?.some((child) => child.path?.includes('stats')) ?? false
  assert.equal(statsUnderPlay, false)
})

test('dungeon runner stats share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath(STATS_PATH)
  assert.ok(entry)
  assert.equal(entry.pasteUnfurl, true)
  assert.equal(PASTE_UNFURL_ROUTES.some((row) => row.routePath === STATS_PATH), true)
})

test('dungeon runner stats tile registry is wired through page model', async () => {
  const { DUNGEON_RUNNER_STATS_TILES } = await import('./dungeonRunnerStatsPageModel.js')
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'total-matches'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'human-win-rate'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'human-eliminated-rate'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'rolling-human-win-rate'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'end-variant-breakdown'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'winner-role-breakdown'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'defeat-flavor-breakdown'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'match-length-over-time'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'matches-per-week'), true)
})
