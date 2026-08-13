<template>
  <div
    v-if="overlayOpen"
    class="gm-flow-overlay"
    data-testid="gm-flow-overlay"
    role="dialog"
    aria-modal="true"
  >
    <GameManagerGameDetail
      v-if="showingDetail"
      :item="gameDetailItem"
      :starting="busy"
      :sessions="sessions"
      :people="people"
      @close="onClose"
      @start-session="onStartSession"
    />

    <GameManagerSessionSetupPanel
      v-else-if="flowPanel === 'setup'"
      :session="activeSession"
      :saved-people="savedPeople"
      :busy="busy"
      :suggestions-for-name="flow.suggestionsForName"
      :peek-next-color="flow.peekNextColor"
      :upsert-person="flow.upsertPerson"
      :set-attendance="flow.setAttendance"
      :add-attendance="flow.addAttendance"
      @close="onClose"
      @start-game="onStartGame"
    />

    <GameManagerSessionPlayingPanel
      v-else-if="flowPanel === 'playing'"
      :session="activeSession"
      :busy="busy"
      @close="onClose"
      @finish-game="onFinishGame"
    />

    <GameManagerSessionScoringPanel
      v-else-if="flowPanel === 'scoring'"
      :session="activeSession"
      :busy="busy"
      @close="onClose"
      @back="onBackToTimer"
      @save="onSave"
    />

    <GameManagerSessionStatisticsPanel
      v-else-if="flowPanel === 'sessionStats'"
      :session="activeSession"
      :sessions="sessions"
      @close="onClose"
      @edit="onEditSessionStats"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted } from 'vue'
import { GAME_MANAGER_SESSION_FLOW_KEY } from '../composables/sessionFlowKey.js'
import GameManagerGameDetail from './GameManagerGameDetail.vue'
import GameManagerSessionPlayingPanel from './GameManagerSessionPlayingPanel.vue'
import GameManagerSessionScoringPanel from './GameManagerSessionScoringPanel.vue'
import GameManagerSessionSetupPanel from './GameManagerSessionSetupPanel.vue'
import GameManagerSessionStatisticsPanel from './GameManagerSessionStatisticsPanel.vue'

const flow = inject(GAME_MANAGER_SESSION_FLOW_KEY)
if (!flow) {
  throw new Error('GameManagerSessionFlowHost requires session flow provide')
}

const gameDetailItem = computed(() => flow.gameDetailItem.value)
const busy = computed(() => flow.busy.value)
const activeSession = computed(() => flow.activeSession.value)
const sessions = computed(() => flow.sessions?.value || [])
const people = computed(() => flow.people?.value || flow.savedPeople?.value || [])
const savedPeople = computed(() => flow.savedPeople.value)
const flowPanel = computed(() => flow.flowPanel.value)
const showingDetail = computed(() => flow.gameDetailOpen.value)
const overlayOpen = computed(() => flow.gameDetailOpen.value || flow.flowPanel.value != null)
/** Setup / scoring / playing stay until explicit close; game detail may dismiss with Escape. */
const overlayPersistent = computed(() => flow.flowPanel.value != null)

function blurActiveElement() {
  const el = document.activeElement
  if (el && el !== document.body && typeof el.blur === 'function') {
    el.blur()
  }
}

function onClose() {
  blurActiveElement()
  flow.leaveFlow()
}

function onDocumentKeydown(event) {
  if (event.key !== 'Escape' || !overlayOpen.value) return
  if (overlayPersistent.value) return
  event.preventDefault()
  onClose()
}

onMounted(() => {
  if (typeof document === 'undefined') return
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', onDocumentKeydown)
})

async function onStartSession() {
  await flow.startNewSession()
}

async function onStartGame() {
  await flow.startGame()
}

async function onFinishGame() {
  await flow.finishGame()
}

async function onBackToTimer() {
  await flow.returnToLinkedTimer()
}

async function onSave(score) {
  await flow.saveAndComplete(score)
}

function onEditSessionStats() {
  flow.editCompleteSessionScores()
}
</script>
