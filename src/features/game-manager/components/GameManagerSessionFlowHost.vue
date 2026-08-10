<template>
  <q-dialog
    :model-value="overlayOpen"
    maximized
    :persistent="overlayPersistent"
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="onOverlayToggle"
    @hide="blurActiveElement"
  >
    <GameManagerGameDetail
      v-if="showingDetail"
      :item="gameDetailItem"
      :starting="busy"
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
      :peek-next-color="flow.peekNextColor"
      :upsert-person="flow.upsertPerson"
      :add-attendance="flow.addAttendance"
      :drop-player="flow.dropPlayer"
      @close="onClose"
      @save="onSave"
    />
  </q-dialog>
</template>

<script setup>
import { computed, inject } from 'vue'
import { GAME_MANAGER_SESSION_FLOW_KEY } from '../composables/sessionFlowKey.js'
import GameManagerGameDetail from './GameManagerGameDetail.vue'
import GameManagerSessionPlayingPanel from './GameManagerSessionPlayingPanel.vue'
import GameManagerSessionScoringPanel from './GameManagerSessionScoringPanel.vue'
import GameManagerSessionSetupPanel from './GameManagerSessionSetupPanel.vue'

const flow = inject(GAME_MANAGER_SESSION_FLOW_KEY)
if (!flow) {
  throw new Error('GameManagerSessionFlowHost requires session flow provide')
}

const gameDetailItem = computed(() => flow.gameDetailItem.value)
const busy = computed(() => flow.busy.value)
const activeSession = computed(() => flow.activeSession.value)
const savedPeople = computed(() => flow.savedPeople.value)
const flowPanel = computed(() => flow.flowPanel.value)
const showingDetail = computed(() => flow.gameDetailOpen.value)
const overlayOpen = computed(() => flow.gameDetailOpen.value || flow.flowPanel.value != null)
const overlayPersistent = computed(() => flow.flowPanel.value != null)

function blurActiveElement() {
  const el = document.activeElement
  if (el && el !== document.body && typeof el.blur === 'function') {
    el.blur()
  }
}

function onOverlayToggle(open) {
  if (!open) onClose()
}

function onClose() {
  blurActiveElement()
  flow.leaveFlow()
}

async function onStartSession() {
  await flow.startNewSession()
}

async function onStartGame() {
  await flow.startGame()
}

async function onFinishGame() {
  await flow.finishGame()
}

async function onSave(score) {
  await flow.saveAndComplete(score)
}
</script>
