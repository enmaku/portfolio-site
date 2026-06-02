<template>
  <q-page class="q-pa-md">
    <div class="text-h5 text-weight-medium q-mb-md">Dungeon Runner Stats</div>

    <q-banner
      v-if="pageModel.showDashboardError"
      data-testid="dungeon-stats-dashboard-error"
      class="bg-grey-9 text-grey-3"
      rounded
    >
      Unable to load match statistics.
    </q-banner>

    <div
      v-else-if="pageModel.showTileGrid"
      data-testid="dungeon-stats-tile-grid"
      class="row q-col-gutter-md"
    >
      <div
        v-for="tile in pageModel.tiles"
        :key="tile.id"
        :class="tileColumnClass(tile)"
      >
        <DungeonRunnerStatsTimeseriesTile
          v-if="tile.presentation === 'timeseries'"
          :tile="tile"
          :tile-deps="tileDeps"
        />
        <DungeonRunnerStatsBreakdownTile
          v-else-if="tile.presentation === 'breakdown-chart'"
          :tile="tile"
          :tile-deps="tileDeps"
        />
        <DungeonRunnerStatsSeriesChartTile
          v-else-if="tile.presentation === 'line-series' || tile.presentation === 'bar-series'"
          :tile="tile"
          :tile-deps="tileDeps"
        />
        <DungeonRunnerStatsTile v-else :tile="tile" :tile-deps="tileDeps" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import DungeonRunnerStatsBreakdownTile from 'src/features/dungeon-runner/stats/components/DungeonRunnerStatsBreakdownTile.vue'
import DungeonRunnerStatsSeriesChartTile from 'src/features/dungeon-runner/stats/components/DungeonRunnerStatsSeriesChartTile.vue'
import DungeonRunnerStatsTile from 'src/features/dungeon-runner/stats/components/DungeonRunnerStatsTile.vue'
import DungeonRunnerStatsTimeseriesTile from 'src/features/dungeon-runner/stats/components/DungeonRunnerStatsTimeseriesTile.vue'
import { createDungeonRunnerStatsTileDeps } from 'src/features/dungeon-runner/stats/createDungeonRunnerStatsTileDeps.js'
import { isDungeonRunnerFirebaseConfigured } from 'src/features/dungeon-runner/firebase/firestore.js'
import { buildDungeonRunnerStatsPageModel } from 'src/features/dungeon-runner/stats/dungeonRunnerStatsPageModel.js'

const tileDeps = createDungeonRunnerStatsTileDeps()

const pageModel = computed(() =>
  buildDungeonRunnerStatsPageModel({
    isFirebaseConfigured: isDungeonRunnerFirebaseConfigured(),
  }),
)

/**
 * @param {{ span?: string }} tile
 */
function tileColumnClass(tile) {
  if (tile.span === 'full') {
    return 'col-12'
  }
  return 'col-12 col-sm-6 col-md-4'
}
</script>
