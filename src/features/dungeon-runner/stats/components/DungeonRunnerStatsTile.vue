<template>
  <DungeonRunnerStatsTileShell
    :title="tile.title"
    :loading="tileState.status === 'loading'"
    :error="tileState.status === 'error'"
  >
    <div
      v-if="tileState.status === 'ok' && isScalarPresentation"
      class="text-h4 text-weight-medium"
      data-testid="dungeon-stats-tile-value"
    >
      {{ tileState.value }}
    </div>

    <div
      v-else-if="tileState.status === 'ok' && tile.presentation === 'breakdown'"
      data-testid="dungeon-stats-tile-breakdown"
    >
      <div
        v-for="row in tileState.breakdown"
        :key="row.key"
        class="row items-center q-col-gutter-sm q-mb-xs"
        :data-testid="`dungeon-stats-breakdown-row-${row.key}`"
      >
        <div class="col text-body2">
          {{ breakdownRowLabel(row.key) }}
        </div>
        <div
          class="col-auto text-h6 text-weight-medium"
          :data-testid="`dungeon-stats-breakdown-count-${row.key}`"
        >
          {{ row.count }}
        </div>
      </div>
    </div>
  </DungeonRunnerStatsTileShell>
</template>

<script setup>
import { computed } from 'vue'
import DungeonRunnerStatsTileShell from './DungeonRunnerStatsTileShell.vue'
import { getDungeonRunnerStatsBreakdownRowLabel } from '../dungeonRunnerStatsBreakdownLabels.js'
import { useDungeonRunnerStatsTile } from '../useDungeonRunnerStatsTile.js'

const props = defineProps({
  tile: {
    type: Object,
    required: true,
  },
  tileDeps: {
    type: Object,
    required: true,
  },
})

const { tileState } = useDungeonRunnerStatsTile(props.tile.loadQuery, props.tileDeps)

const isScalarPresentation = computed(
  () =>
    props.tile.presentation === 'count' ||
    props.tile.presentation === 'rate',
)

function breakdownRowLabel(rowKey) {
  return getDungeonRunnerStatsBreakdownRowLabel(props.tile.id, rowKey)
}
</script>
