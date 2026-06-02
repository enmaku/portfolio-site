import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
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
  assert.equal(entry.title, 'Dungeon Runner Stats')
  assert.equal(entry.title.includes('—'), false)
  assert.equal(PASTE_UNFURL_ROUTES.some((row) => row.routePath === STATS_PATH), true)
})

test('main layout desktop section links stats in-tab with bar_chart', () => {
  const mainLayout = readFileSync(new URL('../../../layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes(`'${STATS_PATH}'`), true)
  assert.equal(mainLayout.includes('bar_chart'), true)
  assert.equal(mainLayout.includes('navigateInTab'), true)
  assert.equal(mainLayout.includes('comingSoon: true'), false)
})

test('dungeon runner stats page gates on Firebase configured without Firestore reads', () => {
  const page = readFileSync(
    new URL('../../../pages/projects/DungeonRunnerStatsPage.vue', import.meta.url),
    'utf8',
  )
  assert.equal(page.includes('isDungeonRunnerFirebaseConfigured'), true)
  assert.equal(page.includes('getDungeonRunnerFirestore'), false)
  assert.equal(page.includes('getCountFromServer'), false)
  assert.equal(page.includes('DungeonRunnerStatsTile'), true)
  assert.equal(page.includes('data-testid="dungeon-stats-dashboard-error"'), true)
  assert.equal(page.includes('data-testid="dungeon-stats-tile-grid"'), true)
  assert.equal(page.includes('col-12 col-sm-6 col-md-4'), true)
})

test('dungeon runner stats tile registry is wired through page model', async () => {
  const { DUNGEON_RUNNER_STATS_TILES } = await import('./dungeonRunnerStatsPageModel.js')
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'total-matches'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'human-win-rate'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'human-eliminated-rate'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'end-variant-breakdown'), true)
  assert.equal(DUNGEON_RUNNER_STATS_TILES.some((tile) => tile.id === 'winner-role-breakdown'), true)
})

test('stats tile shell and orchestration stay free of Firestore imports', () => {
  const shell = readFileSync(
    new URL('./components/DungeonRunnerStatsTileShell.vue', import.meta.url),
    'utf8',
  )
  const tile = readFileSync(new URL('./components/DungeonRunnerStatsTile.vue', import.meta.url), 'utf8')
  const runner = readFileSync(new URL('./useDungeonRunnerStatsTile.js', import.meta.url), 'utf8')
  for (const source of [shell, tile, runner]) {
    assert.equal(source.includes('firebase'), false)
    assert.equal(source.includes('getCountFromServer'), false)
    assert.equal(source.includes('getDocs'), false)
  }
})

test('stats page renders one tile component per registry entry with independent load lifecycle', () => {
  const page = readFileSync(
    new URL('../../../pages/projects/DungeonRunnerStatsPage.vue', import.meta.url),
    'utf8',
  )
  const tile = readFileSync(new URL('./components/DungeonRunnerStatsTile.vue', import.meta.url), 'utf8')
  const shell = readFileSync(
    new URL('./components/DungeonRunnerStatsTileShell.vue', import.meta.url),
    'utf8',
  )
  assert.equal(page.includes('v-for="tile in pageModel.tiles"'), true)
  assert.equal(page.includes(':key="tile.id"'), true)
  assert.equal(page.includes(':tile="tile"'), true)
  assert.equal(tile.includes('useDungeonRunnerStatsTile(props.tile.loadQuery'), true)
  assert.equal(tile.includes('tileState.status'), true)
  assert.equal(shell.includes('data-testid="dungeon-stats-tile-loading"'), true)
  assert.equal(shell.includes('data-testid="dungeon-stats-tile-error"'), true)
})

test('total matches path uses aggregate count only', () => {
  const countQuery = readFileSync(
    new URL('../firebase/matchOutcomeCountQuery.js', import.meta.url),
    'utf8',
  )
  const loader = readFileSync(new URL('./tiles/totalMatchesLoader.js', import.meta.url), 'utf8')
  assert.equal(countQuery.includes('getCountFromServer'), true)
  assert.equal(countQuery.includes('getDocs'), false)
  assert.equal(loader.includes('countAllMatchOutcomes'), true)
  assert.equal(loader.includes('getDocs'), false)
})

test('rate tile loaders use filtered and total count queries only', () => {
  const winLoader = readFileSync(new URL('./tiles/humanWinRateLoader.js', import.meta.url), 'utf8')
  const eliminatedLoader = readFileSync(
    new URL('./tiles/humanEliminatedRateLoader.js', import.meta.url),
    'utf8',
  )
  for (const source of [winLoader, eliminatedLoader]) {
    assert.equal(source.includes('countMatchOutcomesWhere'), true)
    assert.equal(source.includes('countAllMatchOutcomes'), true)
    assert.equal(source.includes('getDocs'), false)
    assert.equal(source.includes('formatMatchOutcomeRate'), true)
  }
  assert.equal(winLoader.includes("'humanWon'"), true)
  assert.equal(eliminatedLoader.includes("'humanEliminated'"), true)
})

test('breakdown tile loaders use filtered count queries only', () => {
  const endVariantLoader = readFileSync(
    new URL('./tiles/endVariantBreakdownLoader.js', import.meta.url),
    'utf8',
  )
  const winnerRoleLoader = readFileSync(
    new URL('./tiles/winnerRoleBreakdownLoader.js', import.meta.url),
    'utf8',
  )
  for (const source of [endVariantLoader, winnerRoleLoader]) {
    assert.equal(source.includes('countMatchOutcomesWhere'), true)
    assert.equal(source.includes('getDocs'), false)
  }
  assert.equal(endVariantLoader.includes("'endVariant'"), true)
  assert.equal(winnerRoleLoader.includes("'winnerRole.type'"), true)
})
