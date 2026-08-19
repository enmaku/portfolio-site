<template>
  <div class="tt-surface tt-timer" data-testid="tt-surface-timer">
    <div class="tt-timer__fields q-px-md q-pt-md">
      <q-select
        :model-value="state.selectedProjectId"
        :options="projectOptions"
        option-value="id"
        option-label="name"
        emit-value
        map-options
        outlined
        dense
        color="orange"
        class="full-width"
        label="Project"
        data-testid="tt-timer-project"
        :disable="!state.projects.length"
        @update:model-value="onSelectProject"
      />
      <q-input
        :model-value="state.description"
        outlined
        dense
        color="orange"
        class="full-width q-mt-md"
        label="Description"
        data-testid="tt-timer-description"
        @update:model-value="workspace.setDescription($event)"
      />
    </div>
    <div class="tt-timer__stage">
      <div class="tt-timer-face-slot">
        <div
          class="tt-timer-face"
          :class="{
            'tt-timer-face--running': Boolean(state.runningTimer),
            'tt-timer-face--complete': ring.completedHours >= 1,
          }"
          :style="accentStyle"
        >
        <svg class="tt-timer-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="tt-timer-ring__track" cx="50" cy="50" r="42" fill="none" />
          <circle
            class="tt-timer-ring__fill"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            transform="rotate(-90 50 50)"
            :stroke-dasharray="fillDash"
          />
          <g v-if="state.runningTimer">
            <polygon class="tt-timer-ring__start" points="50,2.5 54.2,12.5 45.8,12.5" />
            <circle class="tt-timer-ring__now" :cx="nowPoint.x" :cy="nowPoint.y" r="3.4" />
          </g>
        </svg>
        <q-btn
          class="tt-timer-play"
          round
          unelevated
          no-caps
          :disable="!canPlay"
          data-testid="tt-timer-play"
          @click="onPlayPause"
        >
          <div class="column items-center no-wrap tt-timer-play__inner">
            <div class="tt-timer-elapsed" data-testid="tt-timer-elapsed">{{ elapsedLabel }}</div>
            <q-icon
              class="tt-timer-icon"
              :class="{ 'tt-timer-icon--play': !state.runningTimer }"
              :name="state.runningTimer ? 'pause' : 'play_arrow'"
            />
            <div v-if="sessionAmountLabel" class="tt-timer-amount" data-testid="tt-timer-session-amount">
              {{ sessionAmountLabel }}
            </div>
          </div>
        </q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useTimeTrackerSettingsStore } from '../../../stores/timeTrackerSettings.js'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { sessionAmountCents } from '../domain/invoices.js'
import { formatDurationMs, formatUsdFromCents } from '../formatDisplay.js'
import { timerAccentVars } from '../timerAccent.js'
import { ringCircumference, ringPoint, timerHourRing } from '../timerHourRing.js'

const $q = useQuasar()
const settingsStore = useTimeTrackerSettingsStore()
const { timerColor } = storeToRefs(settingsStore)
const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const now = ref(Date.now())
let tick = null

const projectOptions = computed(() => state.projects)
const canPlay = computed(() => Boolean(state.runningTimer) || Boolean(state.selectedProjectId))
const elapsedMs = computed(() => {
  if (!state.runningTimer) return 0
  return Math.max(0, now.value - state.runningTimer.startedAt)
})
const elapsedLabel = computed(() => formatDurationMs(elapsedMs.value))
const activeProject = computed(() => {
  const projectId = state.runningTimer?.projectId || state.selectedProjectId
  return state.projects.find((project) => project.id === projectId) || null
})
const sessionAmountLabel = computed(() => {
  const cents = sessionAmountCents({
    elapsedMs: elapsedMs.value,
    project: activeProject.value,
  })
  if (cents == null) return null
  return formatUsdFromCents(cents)
})
const accentStyle = computed(() => timerAccentVars(timerColor.value, $q.dark.isActive))
const ring = computed(() => timerHourRing(elapsedMs.value))
const fillDash = computed(() => {
  const circ = ringCircumference()
  return `${ring.value.fillFraction * circ} ${circ}`
})
const nowPoint = computed(() => ringPoint(ring.value.markerFraction))

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
