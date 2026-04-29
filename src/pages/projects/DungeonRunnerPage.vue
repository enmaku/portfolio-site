<template>
  <q-page class="dr-page column no-wrap">
    <div class="dr-header row items-center q-px-md q-pt-md q-pb-sm">
      <div class="text-h6">Dungeon Runner</div>
      <q-badge v-if="debugMode" color="negative" class="q-ml-sm" label="Debug" />
      <q-space />
      <q-btn
        v-if="match"
        flat
        dense
        :icon="showHistory ? 'history_toggle_off' : 'history'"
        :label="showHistory ? 'Hide history' : 'Show history'"
        @click="showHistory = !showHistory"
      />
    </div>

    <div class="col dr-scroll q-px-md q-pb-md">
      <q-card v-if="!match" flat bordered class="q-pa-md">
        <div class="text-subtitle1 q-mb-sm">Setup</div>
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="setup.totalSeats"
              :options="[2, 3, 4]"
              label="Total players"
              outlined
              dense
            />
          </div>
        </div>

        <div class="q-gutter-y-sm">
          <div
            v-for="(opponent, index) in setup.opponents"
            :key="`opponent-${index}`"
            class="row items-center q-col-gutter-sm"
          >
            <div class="col-7">
              <q-select
                v-model="opponent.type"
                :options="opponentTypeOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                outlined
                dense
                :label="`Opponent ${index + 1}`"
              />
            </div>
            <div class="col-5" v-if="opponent.type === 'nn'">
              <q-select
                v-if="modelOptions.length"
                v-model="opponent.modelId"
                :options="modelOptions"
                label="Model"
                outlined
                dense
              />
              <q-input v-else v-model="opponent.modelId" label="Model" outlined dense />
            </div>
          </div>
        </div>

        <div class="q-mt-md">
          <q-btn unelevated color="primary" label="Start match" :disable="!setupIsValid" @click="startNewMatch" />
        </div>
      </q-card>

      <template v-else>
        <q-card flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle1 q-mb-sm">Seats</div>
          <div class="q-gutter-y-xs">
            <div
              v-for="seat in match.state.seats"
              :key="seat.id"
              class="row items-center justify-between q-py-xs"
            >
              <div class="text-body2">{{ seat.label }}</div>
              <div class="row items-center q-gutter-x-sm">
                <q-badge :color="roleBadge(seat).color" :label="roleBadge(seat).label" />
                <q-badge
                  v-if="match.state.turn.activeSeatId === seat.id"
                  color="amber-8"
                  text-color="black"
                  label="Turn"
                />
              </div>
            </div>
          </div>
        </q-card>

        <q-card flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Bidding board</div>
          <div class="text-body2 q-mb-xs">
            Dungeon monsters: {{ visibleState?.bidding?.dungeonMonsters?.join(', ') || 'none' }}
          </div>
          <div class="text-body2">
            Revealed card: {{ visibleState?.bidding?.revealedMonsterCard ?? 'hidden / none' }}
          </div>
        </q-card>

        <q-card flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Action</div>
          <div v-if="!isHumanTurn" class="text-body2 text-grey-6">AI is taking its turn…</div>
          <div v-else class="row q-gutter-sm">
            <q-btn
              v-for="action in legalActions"
              :key="actionKey(action)"
              color="primary"
              unelevated
              :label="actionLabel(action)"
              @click="takeHumanAction(action)"
            />
          </div>
        </q-card>

        <q-card v-if="showHistory" flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">History</div>
          <div v-if="match.state.history.length === 0" class="text-body2 text-grey-6">No actions yet.</div>
          <div v-else class="q-gutter-y-xs">
            <div v-for="(entry, index) in match.state.history" :key="`h-${index}`" class="text-caption">
              {{ entry.actorSeatId }} → {{ entry.action.type }}
              <span v-if="entry.dungeonRunResult">[{{ entry.dungeonRunResult }}]</span>
              (rng {{ entry.rngStepBefore }}→{{ entry.rngStepAfter }})
            </div>
          </div>
        </q-card>

        <q-card v-if="debugMode" flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Debug replay</div>
          <div v-if="nnDebugTraceHistory.length" class="q-mb-sm">
            <div class="text-caption text-grey-5 q-mb-xs">NN trace history</div>
            <div v-for="(entry, index) in nnDebugTraceHistory" :key="`nn-trace-${index}`" class="text-caption">
              {{ entry.at }} | {{ entry.modelId }} | {{ entry.trace.kind }} |
              {{ entry.trace.fallbackReason ?? entry.trace.mode ?? 'sample' }}
            </div>
          </div>
          <div class="row q-gutter-sm q-mb-sm">
            <q-btn color="primary" flat label="Export replay" @click="exportReplay" />
            <q-btn color="primary" flat label="Import replay" @click="importReplay" />
          </div>
          <q-input
            v-model="replayExportText"
            type="textarea"
            autogrow
            readonly
            label="Export payload"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input v-model="replayImportText" type="textarea" autogrow label="Import payload" outlined dense />
          <q-input
            v-model="nnDebugTraceText"
            type="textarea"
            autogrow
            readonly
            label="NN trace (features/mask/logits)"
            outlined
            dense
            class="q-mt-sm"
          />
        </q-card>

        <q-card v-if="match.state.lastDungeonRun" flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Last dungeon run</div>
          <div class="text-body2">
            Runner: {{ match.state.lastDungeonRun.runnerSeatId }} |
            Result: {{ match.state.lastDungeonRun.result }} |
            Monsters: {{ match.state.lastDungeonRun.monsters.join(', ') || 'none' }}
          </div>
        </q-card>

        <q-card v-if="match.state.phase === 'match-over'" flat bordered class="q-pa-md">
          <div class="text-subtitle1 q-mb-sm">Bidding complete</div>
          <div class="text-body2 q-mb-md">Runner: {{ runnerLabel }}</div>
          <div class="row q-gutter-sm">
            <q-btn color="primary" unelevated label="Rematch" @click="rematch" />
            <q-btn flat color="primary" label="Back to setup" @click="backToSetup" />
          </div>
        </q-card>
      </template>
    </div>

    <q-dialog v-model="resumeDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-sm">Resume previous match?</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn flat label="Start new" color="primary" @click="startFreshFromDialog" />
          <q-btn unelevated label="Resume" color="primary" @click="resumeFromDialog" />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  applyAction,
  createInitialMatchState,
  getLegalActions,
  getPlayerView,
  shuffleMatchDeck,
  shuffleMatchSeats,
} from '../../features/dungeon-runner/engine/kernel.js'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  decideResumeFlow,
  loadCurrentMatch,
  persistCurrentMatch,
} from '../../features/dungeon-runner/persistence/currentMatch.js'
import { createDefaultSetupConfig, validateSetupConfig } from '../../features/dungeon-runner/setup/config.js'
import { canStartMatchFromSetup, normalizeSetupState } from '../../features/dungeon-runner/setup/state.js'
import { createMatchSeed } from '../../features/dungeon-runner/setup/seed.js'
import { shouldEnableDebugOnBoot } from '../../features/dungeon-runner/debug/mode.js'
import { buildStateFromReplayEnvelope } from '../../features/dungeon-runner/debug/replaySession.js'
import { exportReplayEnvelope, importReplayEnvelope } from '../../features/dungeon-runner/debug/replay.js'
import { chooseRandombotAction } from '../../features/dungeon-runner/bots/randombot.js'
import { chooseNnActionWithFallback } from '../../features/dungeon-runner/nn/runtime.js'
import { createModelFailureRecovery } from '../../features/dungeon-runner/nn/recovery.js'
import { fetchModelCatalog } from '../../features/dungeon-runner/models/catalog.js'
import { pickDefaultModelId, validateSelectedModels } from '../../features/dungeon-runner/models/discovery.js'
import { getRoleBadge } from '../../features/dungeon-runner/ui/roleBadge.js'

const setup = reactive(createDefaultSetupConfig())
const $q = useQuasar()
const match = ref(null)
const showHistory = ref(false)
const resumeDialogOpen = ref(false)
const opponentTypeOptions = [
  { label: 'Random bot', value: 'randombot' },
  { label: 'NN', value: 'nn' },
]
const debugMode = ref(false)
const modelOptions = ref([])
const nnFailureRecovery = createModelFailureRecovery()
const replayImportText = ref('')
const replayExportText = ref('')
const nnDebugTraceText = ref('')
const nnDebugTraceHistory = ref([])

watch(
  () => setup.totalSeats,
  (totalSeats) => {
    const normalized = normalizeSetupState({ totalSeats, opponents: setup.opponents })
    setup.totalSeats = normalized.totalSeats
    setup.opponents.splice(0, setup.opponents.length, ...normalized.opponents)
  },
)

watch(
  () => setup.opponents.map((opponent) => opponent.type),
  () => {
    const defaultModel = pickDefaultModelId(modelOptions.value)
    if (!defaultModel) return
    for (const opponent of setup.opponents) {
      if (opponent.type === 'nn' && !opponent.modelId) opponent.modelId = defaultModel
    }
  },
)

const setupIsValid = computed(
  () =>
    validateSetupConfig(normalizeSetupState(setup)).ok &&
    canStartMatchFromSetup(setup) &&
    validateSelectedModels(setup.opponents, modelOptions.value).ok,
)
const humanSeatId = computed(() => match.value?.state.seats.find((seat) => seat.role.type === 'human')?.id ?? null)
const isHumanTurn = computed(
  () => !!match.value && humanSeatId.value != null && match.value.state.turn.activeSeatId === humanSeatId.value,
)
const legalActions = computed(() => {
  if (!match.value || !isHumanTurn.value) return []
  return getLegalActions(match.value.state, { seatId: humanSeatId.value })
})
const visibleState = computed(() => {
  if (!match.value || !humanSeatId.value) return null
  return getPlayerView(match.value.state, { seatId: humanSeatId.value })
})
const runnerLabel = computed(() => {
  if (!match.value) return ''
  const runner = match.value.state.seats.find((seat) => seat.id === match.value.state.bidding.runnerSeatId)
  return runner?.label ?? 'Unknown'
})

onMounted(() => {
  debugMode.value = shouldEnableDebugOnBoot(window.location.href)
  if (decideResumeFlow(window.localStorage).mode === 'resume-or-start-new') {
    resumeDialogOpen.value = true
  }
  void loadModelCatalog()
})

watch(
  () => match.value?.state,
  (state) => {
    if (!match.value || !state) return
    persistCurrentMatch(window.localStorage, match.value)
    if ((state.phase === 'bidding' || state.phase === 'dungeon') && !isHumanTurn.value) {
      window.setTimeout(() => {
        void runAiTurn()
      }, 200)
    }
  },
  { deep: true },
)

function startNewMatch() {
  const modelValidation = validateSelectedModels(setup.opponents, modelOptions.value)
  if (!modelValidation.ok) {
    $q.notify({
      type: 'negative',
      message:
        modelValidation.errorCode === 'MODEL_REQUIRED'
          ? 'Every NN opponent must select a model.'
          : 'One or more NN model selections are unavailable.',
    })
    return
  }
  clearCurrentMatch(window.localStorage)
  const seed = createMatchSeed()
  const id = `match-${Date.now()}`
  const setupSnapshot = cloneSetup()
  const baseState = createInitialMatchState(setupSnapshot, { seed })
  const shuffledState = shuffleMatchDeck(shuffleMatchSeats(baseState, { seed: seed ^ 0x5f3759df }), {
    seed: seed ^ 0x9e3779b9,
  })
  match.value = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id,
    setup: setupSnapshot,
    state: shuffledState,
    history: [],
  }
  showHistory.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
}

function rematch() {
  if (!match.value) return
  const seed = createMatchSeed()
  const id = `match-${Date.now()}`
  const setupSnapshot = cloneSetup(match.value.setup)
  const baseState = createInitialMatchState(setupSnapshot, { seed })
  const shuffledState = shuffleMatchDeck(shuffleMatchSeats(baseState, { seed: seed ^ 0x5f3759df }), {
    seed: seed ^ 0x9e3779b9,
  })
  match.value = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id,
    setup: setupSnapshot,
    state: shuffledState,
    history: [],
  }
  showHistory.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
}

function backToSetup() {
  match.value = null
  clearCurrentMatch(window.localStorage)
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
}

function takeHumanAction(action) {
  if (!match.value || !humanSeatId.value) return
  const result = applyAction(match.value.state, action, { seatId: humanSeatId.value })
  if (!result.ok) return
  match.value = { ...match.value, state: result.state }
}

async function runAiTurn() {
  if (!match.value || (match.value.state.phase !== 'bidding' && match.value.state.phase !== 'dungeon')) return
  const seatId = match.value.state.turn.activeSeatId
  if (!seatId || seatId === humanSeatId.value) return
  console.log('[DungeonRunner][AITurn][Start]', {
    phase: match.value.state.phase,
    seatId,
    humanSeatId: humanSeatId.value,
    turnNumber: match.value.state.turn.turnNumber,
  })
  const seat = match.value.state.seats.find((candidate) => candidate.id === seatId)
  const roleType = seat?.role?.type
  let action = null
  if (roleType === 'nn') {
    const modelId = seat.role.modelId ?? 'latest'
    console.log('[DungeonRunner][AITurn][NN]', { seatId, modelId })
    if (nnFailureRecovery.isCoolingDown(modelId)) {
      action = chooseRandombotAction(match.value.state, { seatId })
    } else {
      action = await chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(modelId))
      if (action?.meta?.fallbackReason === 'MODEL_LOAD_FAILED') {
        action = await handleNnModelFailure(seat, modelId, seatId, action)
      }
    }
  } else {
    console.log('[DungeonRunner][AITurn][Randombot]', { seatId })
    action = chooseRandombotAction(match.value.state, { seatId })
  }
  console.log('[DungeonRunner][AITurn][Action]', { seatId, action })
  if (!action) return
  const result = applyAction(match.value.state, action, { seatId })
  if (!result.ok) return
  match.value = { ...match.value, state: result.state }
}

async function handleNnModelFailure(seat, modelId, seatId, fallbackAction) {
  nnFailureRecovery.recordFailure(modelId)
  const downgradeTarget = getDowngradeModelId(modelId)
  const wantsRetry = window.confirm(
    `Model "${modelId}" failed to load. Press OK to retry once, or Cancel for recovery options.`,
  )
  if (wantsRetry) {
    return chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(modelId))
  }
  if (downgradeTarget) {
    const wantsDowngrade = window.confirm(`Downgrade to "${downgradeTarget}"? Cancel uses safe fallback.`)
    if (wantsDowngrade) {
      seat.role.modelId = downgradeTarget
      return chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(downgradeTarget))
    }
  }
  return fallbackAction
}

function getDowngradeModelId(failedModelId) {
  const candidates = modelOptions.value.filter((id) => id !== failedModelId && !nnFailureRecovery.isCoolingDown(id))
  return candidates[0] ?? null
}

function nnRuntimeOptions(modelId) {
  if (!debugMode.value) return { modelId }
  return {
    modelId,
    debugTrace: true,
    debugLogger(trace) {
      const payload = {
        at: new Date().toISOString(),
        modelId,
        seatId: match.value?.state?.turn?.activeSeatId ?? null,
        trace,
      }
      nnDebugTraceHistory.value = [payload, ...nnDebugTraceHistory.value].slice(0, 20)
      nnDebugTraceText.value = JSON.stringify(payload, null, 2)
      console.log('[DungeonRunner][NNTrace]', payload)
    },
  }
}

function roleBadge(seat) {
  return getRoleBadge(seat)
}

function actionLabel(action) {
  if (action.type === 'ADD_TO_DUNGEON') return 'Add card to dungeon'
  if (action.type === 'SACRIFICE') return `Sacrifice ${action.equipmentId}`
  if (action.type === 'ADVANCE_DUNGEON') return 'Run dungeon'
  return action.type
}

function actionKey(action) {
  return `${action.type}-${action.equipmentId ?? ''}`
}

function resumeFromDialog() {
  const loaded = loadCurrentMatch(window.localStorage)
  if (!loaded.ok) {
    resumeDialogOpen.value = false
    return
  }
  match.value = loaded.match
  resumeDialogOpen.value = false
}

function startFreshFromDialog() {
  clearCurrentMatch(window.localStorage)
  resumeDialogOpen.value = false
}

function cloneSetup(source = setup) {
  return {
    totalSeats: source.totalSeats,
    opponents: source.opponents.map((opponent) => ({ ...opponent })),
  }
}

async function loadModelCatalog() {
  const catalog = await fetchModelCatalog()
  modelOptions.value = catalog.models
  const defaultModel = pickDefaultModelId(catalog.models)
  if (!defaultModel) return
  for (const opponent of setup.opponents) {
    if (opponent.type === 'nn' && !opponent.modelId) {
      opponent.modelId = defaultModel
    }
  }
}

function exportReplay() {
  if (!match.value) return
  const payload = exportReplayEnvelope({
    seed: match.value.state.rng.seed,
    setup: match.value.setup,
    history: match.value.state.history,
  })
  replayExportText.value = JSON.stringify(payload, null, 2)
}

function importReplay() {
  if (!replayImportText.value.trim()) return
  try {
    const parsed = JSON.parse(replayImportText.value)
    const imported = importReplayEnvelope(parsed)
    if (!imported.ok) {
      $q.notify({ type: 'negative', message: 'Replay payload is invalid.' })
      return
    }
    const replayResult = buildStateFromReplayEnvelope(imported.replay)
    if (!replayResult.ok) {
      $q.notify({ type: 'negative', message: 'Replay actions are invalid for this seed/setup.' })
      return
    }
    match.value = {
      schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
      id: `match-${Date.now()}`,
      setup: imported.replay.setup,
      state: replayResult.state,
      history: [],
    }
    showHistory.value = true
  } catch {
    $q.notify({ type: 'negative', message: 'Replay payload must be valid JSON.' })
  }
}
</script>

<style scoped>
.dr-page {
  flex: 1 1 0;
  min-height: 0;
}

.dr-scroll {
  overflow-y: auto;
  min-height: 0;
}

.dr-header {
  flex-shrink: 0;
}
</style>
