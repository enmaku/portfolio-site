<template>
  <q-page class="dr-page column fit no-wrap">
    <div class="dr-header row items-center q-px-md q-pt-md q-pb-sm">
      <div class="row items-center q-gutter-xs">
        <q-btn
          v-if="match"
          flat
          dense
          icon="refresh"
          aria-label="Start new match"
          :disable="liveMatch.dungeonOutcomeDialogOpen"
          @click="startNewMatchIntentional"
        />
        <q-badge v-if="debugMode" color="negative" label="Debug" />
      </div>
      <div class="text-h6 dr-header-title">Dungeon Runner</div>
      <q-space />
      <q-btn
        flat
        dense
        icon="help"
        aria-label="How to play"
        :disable="match && liveMatch.dungeonOutcomeDialogOpen"
        @click="helpOpen = true"
      />
      <q-btn
        flat
        dense
        icon="settings"
        aria-label="Dungeon Runner settings"
        :disable="Boolean(match) && liveMatch.dungeonOutcomeDialogOpen"
      >
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <div class="dr-match-settings-menu q-pa-md" style="min-width: 260px">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Animation speed</div>
            <q-option-group
              v-model="presentationSpeedProfile"
              :options="presentationSpeedOptions"
              color="primary"
              type="radio"
            />
            <q-separator class="q-my-md" />
            <q-toggle
              :model-value="dungeonRunnerSettingsStore.memoryAidEnabled"
              dense
              label="Memory Aid"
              aria-label="Toggle memory aid"
              @update:model-value="onMemoryAidToggle"
            />
            <q-separator class="q-my-md" />
            <q-toggle v-model="fullscreenModel" dense color="primary" label="Fullscreen" />
          </div>
        </q-menu>
      </q-btn>
    </div>

    <div class="col dr-scroll q-px-md q-pb-md">
      <PlaySetupShell
        v-if="activePlayShell === PLAY_SHELL.PLAY_SETUP"
        v-model:setup="setup"
        :model-options="modelOptions"
        :total-seat-slider="totalSeatSlider"
        :opponent-type-options="opponentTypeOptions"
        v-model:neural-load-gate-terminal-open="neuralLoadGateTerminalOpen"
        @start-match="startNewMatch"
      />

      <LiveMatchShell v-else-if="activePlayShell === PLAY_SHELL.LIVE_MATCH" />

      <MatchOverShell
        v-else-if="activePlayShell === PLAY_SHELL.MATCH_OVER"
        :match="match"
        :human-seat-id="humanSeatId"
        :debug-mode="debugMode"
        :replay-export-text="replayExportText"
        :nn-debug-trace-text="nnDebugTraceText"
        :nn-debug-trace-history="nnDebugTraceHistory"
        :upload-tracker="completedMatchReplayUpload"
        @rematch="rematch"
        @back-to-setup="backToSetup"
        @export-replay="exportReplay"
      />
    </div>

    <DungeonRunnerHelpDialog v-model="helpOpen" />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useScopedFullscreen } from '../../features/game-timer/composables/useScopedFullscreen.js'
import { useDungeonRunnerSettingsStore } from '../../stores/dungeonRunnerSettings.js'
import { clearCurrentMatch } from '../../features/dungeon-runner/persistence/currentMatch.js'
import { createDefaultSetupConfig } from '../../features/dungeon-runner/setup/config.js'
import { createMatchSeed } from '../../features/dungeon-runner/setup/seed.js'
import { shouldEnableDebugOnBoot } from '../../features/dungeon-runner/debug/mode.js'
import { createNeuralRuntimeRecoveryCoordinator } from '../../features/dungeon-runner/nn/recovery.js'
import { fetchModelCatalog } from '../../features/dungeon-runner/models/catalog.js'
import { evaluatePlaySetupStart, applyNnDefaultModelIds } from '../../features/dungeon-runner/ui/playSetupShell.js'
import { bootstrapCurrentMatchFromStorage } from '../../features/dungeon-runner/matchPageOrchestration.js'
import DungeonRunnerHelpDialog from '../../features/dungeon-runner/ui/DungeonRunnerHelpDialog.vue'
import {
  PLAY_SHELL,
  buildPlayShellSnapshot,
  resolveActivePlayShell,
} from '../../features/dungeon-runner/ui/playShellResolver.js'
import PlaySetupShell from '../../features/dungeon-runner/ui/shells/PlaySetupShell.vue'
import LiveMatchShell from '../../features/dungeon-runner/ui/shells/LiveMatchShell.vue'
import MatchOverShell from '../../features/dungeon-runner/ui/shells/MatchOverShell.vue'
import { useLiveMatchShell } from '../../features/dungeon-runner/ui/shells/useLiveMatchShell.js'
import { LIVE_MATCH_SHELL_SESSION_KEY } from '../../features/dungeon-runner/ui/shells/liveMatchShellSessionKey.js'
import { createCompletedMatchReplayUploadTracker } from '../../features/dungeon-runner/firebase/completedMatchReplayUpload.js'

const completedMatchReplayUpload = createCompletedMatchReplayUploadTracker(window.sessionStorage)

const setup = reactive(createDefaultSetupConfig())
const $q = useQuasar()
const helpOpen = ref(false)
const match = ref(null)
const totalSeatSlider = { min: 2, max: 4, step: 1 }
const opponentTypeOptions = [
  { label: 'Random bot', value: 'randombot' },
  { label: 'AI', value: 'nn' },
]
const debugMode = ref(false)
const modelOptions = ref([])
const nnRecovery = createNeuralRuntimeRecoveryCoordinator()
const replayImportText = ref('')
const replayExportText = ref('')
const nnDebugTraceText = ref('')
const nnDebugTraceHistory = ref([])
const neuralLoadGateTerminalOpen = ref(false)
const matchNeuralLoadGateInFlight = ref(false)

const dungeonRunnerSettingsStore = useDungeonRunnerSettingsStore()
const { fullscreenEnabled } = storeToRefs(dungeonRunnerSettingsStore)

useScopedFullscreen({
  enabled: fullscreenEnabled,
  setEnabled: (next) => dungeonRunnerSettingsStore.setFullscreenEnabled(next),
  getTargetElement: () => document.documentElement,
  onRequestFailure: () => {
    $q.notify({
      type: 'warning',
      message: 'Fullscreen could not be enabled.',
      timeout: 2500,
      position: 'top',
    })
  },
})

const fullscreenModel = computed({
  get: () => fullscreenEnabled.value,
  set: (value) => dungeonRunnerSettingsStore.setFullscreenEnabled(Boolean(value)),
})

const presentationSpeedProfile = computed({
  get() {
    return dungeonRunnerSettingsStore.animationPace
  },
  set(value) {
    dungeonRunnerSettingsStore.setAnimationPace(value)
  },
})

const presentationSpeedOptions = [
  { label: 'Cinematic', value: 'cinematic' },
  { label: 'Brisk', value: 'brisk' },
]

function cloneSetup(source = setup) {
  return {
    totalSeats: source.totalSeats,
    opponents: source.opponents.map((opponent) => ({ ...opponent })),
  }
}

const liveMatch = useLiveMatchShell({
  match,
  debugMode,
  presentationSpeedProfile,
  dungeonRunnerSettingsStore,
  setup,
  cloneSetup,
  nnRecovery,
  replayImportText,
  replayExportText,
  nnDebugTraceText,
  nnDebugTraceHistory,
  neuralLoadGateTerminalOpen,
  matchNeuralLoadGateInFlight,
  notify: (opts) => $q.notify(opts),
})

provide(LIVE_MATCH_SHELL_SESSION_KEY, liveMatch)

const humanSeatId = computed(
  () => match.value?.state.seats.find((seat) => seat.role.type === 'human')?.id ?? null,
)

const activePlayShell = computed(() =>
  resolveActivePlayShell(
    buildPlayShellSnapshot({
      match: match.value,
      neuralRefreshTerminalSurfaced: liveMatch.neuralRefreshTerminalOpen,
      matchNeuralLoadGateInFlight: matchNeuralLoadGateInFlight.value,
    }),
  ),
)

watch(
  activePlayShell,
  (shell) => {
    if (shell === PLAY_SHELL.LIVE_MATCH) {
      liveMatch.mountLiveMatchShell()
    } else {
      liveMatch.unmountLiveMatchShell()
    }
  },
  { immediate: true },
)

onMounted(() => {
  debugMode.value = shouldEnableDebugOnBoot(window.location.href)
  void bootstrapDungeonRunnerPage()
  void loadModelCatalog()
})

onBeforeUnmount(() => {
  liveMatch.unmountLiveMatchShell()
})

async function bootstrapDungeonRunnerPage() {
  const result = await bootstrapCurrentMatchFromStorage(liveMatch.matchPageOrchestrationCtx)
  liveMatch.processBootstrappedSession(result)
}

async function startNewMatch() {
  const startCheck = evaluatePlaySetupStart({
    setup,
    modelOptions: modelOptions.value,
  })
  if (!startCheck.ok) {
    const message =
      startCheck.errorCode === 'MODEL_REQUIRED'
        ? 'Every NN opponent must select a model.'
        : startCheck.errorCode === 'MODEL_UNAVAILABLE'
          ? 'One or more NN model selections are unavailable.'
          : 'Match setup is invalid.'
    $q.notify({ type: 'negative', message })
    return
  }
  const setupSnapshot = cloneSetup()
  matchNeuralLoadGateInFlight.value = true
  try {
    const gateResult = await liveMatch.runLivePageMatchEntryGate(setupSnapshot)
    if (gateResult.kind === 'setup-terminal') {
      liveMatch.resetForSetupTerminal()
      return
    }
    clearCurrentMatch(window.localStorage)
    const seed = createMatchSeed()
    liveMatch.resetForFreshMatchEntry()
    match.value = liveMatch.buildNewMatchEnvelope({
      setupSnapshot,
      seed,
      id: `match-${Date.now()}`,
      presentationSpeedProfile: presentationSpeedProfile.value,
    })
  } finally {
    matchNeuralLoadGateInFlight.value = false
    liveMatch.kickMatchAutomation()
  }
}

async function rematch() {
  if (!match.value) return
  const setupSnapshot = cloneSetup(match.value.setup)
  matchNeuralLoadGateInFlight.value = true
  try {
    const gateResult = await liveMatch.runLivePageMatchEntryGate(setupSnapshot)
    if (gateResult.kind === 'setup-terminal') {
      liveMatch.resetForSetupTerminal()
      return
    }
    const preservedBotLabels = match.value.state.seats
      .filter((seat) => seat.role?.type !== 'human' && seat.label)
      .map((seat) => seat.label)
    const seed = createMatchSeed()
    liveMatch.resetForFreshMatchEntry()
    match.value = liveMatch.buildNewMatchEnvelope({
      setupSnapshot,
      seed,
      id: `match-${Date.now()}`,
      presentationSpeedProfile: presentationSpeedProfile.value,
      preservedBotLabels,
    })
  } finally {
    matchNeuralLoadGateInFlight.value = false
    liveMatch.kickMatchAutomation()
  }
}

function backToSetup() {
  liveMatch.resetForBackToSetup()
}

function exportReplay() {
  liveMatch.exportReplay()
}

async function startNewMatchIntentional() {
  const shouldStartFresh = await liveMatch.requestConfirmation({
    title: 'Start a new match?',
    message: 'This will discard your current match and return to setup.',
    okLabel: 'Start new',
    cancelLabel: 'Cancel',
  })
  if (!shouldStartFresh) return
  backToSetup()
}

function onMemoryAidToggle(enabled) {
  dungeonRunnerSettingsStore.setMemoryAidEnabled(enabled === true)
}

async function loadModelCatalog() {
  const catalog = await fetchModelCatalog()
  modelOptions.value = catalog.models
  applyNnDefaultModelIds(setup, catalog.models)
}
</script>

<style scoped>
.dr-page {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.dr-scroll {
  overflow-y: auto;
  min-height: 0;
}

.dr-header {
  flex-shrink: 0;
  position: relative;
  z-index: 30;
}

.dr-header-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
