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

  </DungeonRunnerStatsTileShell>
</template>

<script setup>
import { computed } from 'vue'
import DungeonRunnerStatsTileShell from './DungeonRunnerStatsTileShell.vue'
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

</script>
