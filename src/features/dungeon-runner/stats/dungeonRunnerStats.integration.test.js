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
  assert.equal(page.includes('items-stretch'), true)
  assert.equal(page.includes("'flex column'"), true)
  assert.equal(page.includes('tileColumnClass'), true)
  assert.equal(page.includes('DungeonRunnerStatsTimeseriesTile'), false)
  assert.equal(page.includes('DungeonRunnerStatsBreakdownTile'), true)
  assert.equal(page.includes("'breakdown-chart'"), true)
  assert.equal(page.includes('DungeonRunnerStatsSeriesChartTile'), true)
  assert.equal(page.includes("'line-series'"), true)
  assert.equal(page.includes("'bar-series'"), true)
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

test('stats tile shell and orchestration stay free of Firestore imports', () => {
  const shell = readFileSync(
    new URL('./components/DungeonRunnerStatsTileShell.vue', import.meta.url),
    'utf8',
  )
  const tile = readFileSync(new URL('./components/DungeonRunnerStatsTile.vue', import.meta.url), 'utf8')
  const runner = readFileSync(new URL('./useDungeonRunnerStatsTile.js', import.meta.url), 'utf8')
  const seriesChartRunner = readFileSync(
    new URL('./useDungeonRunnerStatsSeriesChartTile.js', import.meta.url),
    'utf8',
  )
  const breakdownTile = readFileSync(
    new URL('./components/DungeonRunnerStatsBreakdownTile.vue', import.meta.url),
    'utf8',
  )
  const seriesChartTile = readFileSync(
    new URL('./components/DungeonRunnerStatsSeriesChartTile.vue', import.meta.url),
    'utf8',
  )
  for (const source of [shell, tile, runner, seriesChartRunner, breakdownTile, seriesChartTile]) {
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
  const breakdownTile = readFileSync(
    new URL('./components/DungeonRunnerStatsBreakdownTile.vue', import.meta.url),
    'utf8',
  )
  const shell = readFileSync(
    new URL('./components/DungeonRunnerStatsTileShell.vue', import.meta.url),
    'utf8',
  )
  assert.equal(page.includes('v-for="tile in pageModel.tiles"'), true)
  assert.equal(page.includes(':key="tile.id"'), true)
  assert.equal(page.includes(':tile="tile"'), true)
  assert.equal(tile.includes('useDungeonRunnerStatsTile(props.tile.loadQuery'), true)
  assert.equal(breakdownTile.includes('useDungeonRunnerStatsTile(props.tile.loadQuery'), true)
  assert.equal(breakdownTile.includes('buildMatchOutcomeBreakdownChart'), true)
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

test('breakdown chart tile keeps chart data shaping out of loaders', () => {
  const breakdownTile = readFileSync(
    new URL('./components/DungeonRunnerStatsBreakdownTile.vue', import.meta.url),
    'utf8',
  )
  const chartBuilder = readFileSync(
    new URL('./buildMatchOutcomeBreakdownChart.js', import.meta.url),
    'utf8',
  )
  assert.equal(breakdownTile.includes('buildMatchOutcomeBreakdownChart'), true)
  assert.equal(chartBuilder.includes('chart.js'), false)
  assert.equal(breakdownTile.includes('getDocs'), false)
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
  const defeatFlavorLoader = readFileSync(
    new URL('./tiles/defeatFlavorBreakdownLoader.js', import.meta.url),
    'utf8',
  )
  for (const source of [endVariantLoader, winnerRoleLoader, defeatFlavorLoader]) {
    assert.equal(source.includes('countMatchOutcomesWhere'), true)
    assert.equal(source.includes('getDocs'), false)
  }
  assert.equal(endVariantLoader.includes("'endVariant'"), true)
  assert.equal(winnerRoleLoader.includes("'winnerRole.type'"), true)
  assert.equal(defeatFlavorLoader.includes("'endVariant'"), true)
})

test('defeat flavor breakdown loader counts only non-victory end variants', () => {
  const loader = readFileSync(
    new URL('./tiles/defeatFlavorBreakdownLoader.js', import.meta.url),
    'utf8',
  )
  assert.equal(loader.includes('DEFEAT_FLAVOR_BREAKDOWN_KEYS'), true)
  assert.equal(loader.includes('ELIMINATION_END_HUMAN'), true)
  assert.equal(loader.includes('VICTORY'), false)
})

test('match length over time uses bounded match length series query only', () => {
  const seriesQuery = readFileSync(
    new URL('../firebase/matchLengthSeriesQuery.js', import.meta.url),
    'utf8',
  )
  const loader = readFileSync(
    new URL('./tiles/matchLengthOverTimeLoader.js', import.meta.url),
    'utf8',
  )
  assert.equal(seriesQuery.includes('getDocs'), true)
  assert.equal(seriesQuery.includes('historyStepCount'), true)
  assert.equal(seriesQuery.includes('MATCH_LENGTH_SERIES_FETCH_LIMIT'), true)
  assert.equal(loader.includes('fetchMatchLengthSeries'), true)
  assert.equal(loader.includes('getDocs'), false)
  assert.equal(loader.includes('loadMatchSequenceChartTile'), true)
  assert.equal(loader.includes('buildMatchLengthOverTimeChart'), true)
  const sequenceChart = readFileSync(
    new URL('./buildMatchSequenceOverTimeChart.js', import.meta.url),
    'utf8',
  )
  const sequenceLoader = readFileSync(
    new URL('./loadMatchSequenceChartTile.js', import.meta.url),
    'utf8',
  )
  assert.equal(sequenceChart.includes('computeRollingAverage'), true)
  assert.equal(sequenceChart.includes('buildModelPublishMarkersForWinSeries'), true)
  assert.equal(sequenceLoader.includes('resolveMatchSequenceTrendWindowSize'), true)
  assert.equal(sequenceLoader.includes('fetchModelCatalog'), true)
  assert.equal(loader.includes('matchLengthSeries'), true)
  const seriesTile = readFileSync(
    new URL('./components/DungeonRunnerStatsSeriesChartTile.vue', import.meta.url),
    'utf8',
  )
  assert.equal(seriesTile.includes('createModelPublishLinePlugin'), true)
  assert.equal(seriesTile.includes('match-length-over-time'), true)
  assert.equal(seriesTile.includes('rolling-human-win-rate'), true)
  assert.equal(seriesTile.includes('useDungeonRunnerStatsSeriesChartTile'), true)
  assert.equal(seriesTile.includes('dungeon-stats-trend-window-slider'), true)
})

test('matches per week uses aggregate count queries per week bucket', () => {
  const countQuery = readFileSync(
    new URL('../firebase/matchOutcomeCountQuery.js', import.meta.url),
    'utf8',
  )
  const loader = readFileSync(new URL('./tiles/matchesPerWeekLoader.js', import.meta.url), 'utf8')
  assert.equal(countQuery.includes('countMatchOutcomesCreatedBetween'), true)
  assert.equal(loader.includes('countMatchOutcomesCreatedBetween'), true)
  const weekChart = readFileSync(
    new URL('./buildMatchesPerWeekChart.js', import.meta.url),
    'utf8',
  )
  assert.equal(weekChart.includes('MATCHES_PER_WEEK_MAX_WEEKS'), true)
  assert.equal(weekChart.includes('computeRollingWeekAverage'), true)
  assert.equal(loader.includes('rollingAverageValues'), true)
  assert.equal(loader.includes('getDocs'), false)
  const seriesTile = readFileSync(
    new URL('./components/DungeonRunnerStatsSeriesChartTile.vue', import.meta.url),
    'utf8',
  )
  assert.equal(seriesTile.includes('rollingAverageValues'), true)
  assert.equal(seriesTile.includes('#eab308'), true)
  assert.equal(seriesTile.includes('matches-per-week'), true)
  assert.equal(seriesTile.includes('dungeon-stats-trend-window-slider'), true)
  assert.equal(loader.includes('resolveMatchesPerWeekTrendWindowSize'), true)
  assert.equal(loader.includes('weeklyCounts'), true)
})

test('human win rate over time tile uses bounded human win series query only', () => {
  const seriesQuery = readFileSync(
    new URL('../firebase/humanWinSeriesQuery.js', import.meta.url),
    'utf8',
  )
  const loader = readFileSync(
    new URL('./tiles/rollingHumanWinRateLoader.js', import.meta.url),
    'utf8',
  )
  const seriesTile = readFileSync(
    new URL('./components/DungeonRunnerStatsSeriesChartTile.vue', import.meta.url),
    'utf8',
  )
  assert.equal(seriesQuery.includes('getDocs'), true)
  assert.equal(seriesQuery.includes("'createdAt', 'desc'"), true)
  assert.equal(seriesQuery.includes('humanWon'), true)
  assert.equal(seriesQuery.includes('HUMAN_WIN_SERIES_FETCH_LIMIT'), true)
  assert.equal(loader.includes('fetchHumanWinSeries'), true)
  assert.equal(loader.includes('getDocs'), false)
  assert.equal(loader.includes('loadMatchSequenceChartTile'), true)
  assert.equal(loader.includes('buildHumanWinRateOverTimeChart'), true)
  assert.equal(loader.includes('resolveHumanWinRateTrendWindowSize'), true)
  assert.equal(seriesTile.includes('rolling-human-win-rate'), true)
  assert.equal(seriesTile.includes('dungeon-stats-trend-window-slider'), true)
  assert.equal(seriesTile.includes('createModelPublishLinePlugin'), true)
  const markerBuilder = readFileSync(
    new URL('./buildModelPublishMarkersForWinSeries.js', import.meta.url),
    'utf8',
  )
  assert.equal(markerBuilder.includes('latest'), true)
  assert.equal(markerBuilder.includes('publishedAtByModelId'), true)
})
