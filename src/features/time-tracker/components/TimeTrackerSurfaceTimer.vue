<template>
  <div class="tt-surface" data-testid="tt-surface-timer">
    <div class="tt-surface__scroll column items-center q-pa-lg">
      <q-select
        :model-value="state.selectedProjectId"
        :options="projectOptions"
        option-value="id"
        option-label="name"
        emit-value
        map-options
        outlined
        dense
        class="full-width q-mb-md"
        data-testid="tt-timer-project"
        :disable="!state.projects.length"
        @update:model-value="onSelectProject"
      />
      <q-input
        :model-value="state.description"
        outlined
        dense
        class="full-width q-mb-lg"
        data-testid="tt-timer-description"
        @update:model-value="workspace.setDescription($event)"
      />
      <div class="text-h4 q-mb-lg" data-testid="tt-timer-elapsed">{{ elapsedLabel }}</div>
      <q-btn
        class="tt-play"
        round
        color="primary"
        :icon="state.runningTimer ? 'pause' : 'play_arrow'"
        data-testid="tt-timer-play"
        :disable="!canPlay"
        @click="onPlayPause"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { formatDurationMs } from '../formatDisplay.js'

const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const now = ref(Date.now())
let tick = null

const projectOptions = computed(() => state.projects)
const canPlay = computed(() => Boolean(state.runningTimer) || Boolean(state.selectedProjectId))
const elapsedLabel = computed(() => {
  if (!state.runningTimer) return formatDurationMs(0)
  return formatDurationMs(now.value - state.runningTimer.startedAt)
})

onMounted(() => {
  tick = setInterval(() => {
    now.value = Date.now()
  }, 250)
})

onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
})

async function onSelectProject(projectId) {
  await workspace.selectProject(projectId)
}

async function onPlayPause() {
  if (state.runningTimer) await workspace.pause()
  else await workspace.play()
}
</script>
