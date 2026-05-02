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
        icon="history"
        label="History"
        aria-label="Open match history"
        @click="historyDrawerOpen = true"
      />
      <q-toggle
        v-if="match"
        :model-value="memoryAidState.enabled"
        dense
        label="Memory Aid"
        aria-label="Toggle memory aid"
        @update:model-value="onMemoryAidToggle"
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
              behavior="menu"
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
                behavior="menu"
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
                behavior="menu"
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
              <div class="row items-center q-gutter-x-sm">
                <q-avatar square size="20px">
                  <img
                    :src="seat.role.type === 'human' ? uiAssets.icons.runner.runtimePath : uiAssets.icons.monster.runtimePath"
                    :alt="seat.role.type === 'human' ? 'Runner icon' : 'Monster icon'"
                  />
                </q-avatar>
                <div class="text-body2">{{ seat.label }}</div>
              </div>
              <div class="row items-center q-gutter-x-sm">
                <q-badge :color="roleBadge(seat).color" :label="roleBadge(seat).label" />
                <q-avatar v-if="match.state.turn.activeSeatId === seat.id" square size="16px">
                  <img :src="uiAssets.counters.turn.runtimePath" alt="Turn counter" />
                </q-avatar>
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

        <q-card flat bordered class="q-pa-md q-mb-md dr-bidding-board" :class="biddingBoard.heroCue.accentClass">
          <div class="text-subtitle2 q-mb-sm">Bidding board</div>
          <div class="dr-board-primary q-mb-sm">
            <MonsterCardFace
              class="dr-card-preview dr-card-preview--hero"
              :species="biddingBoard.primaryCard.variant === 'revealed' ? biddingBoard.primaryCard.monsterCard : null"
              :face-down="biddingBoard.primaryCard.variant !== 'revealed'"
            />
          </div>
          <div class="row q-col-gutter-xs items-start">
            <div class="col-4">
              <q-badge
                color="grey-8"
                class="full-width q-py-xs dr-deck-badge"
                align="between"
                :class="{ 'dr-deck-badge--interactive': biddingBoard.memoryAid.deckTapEnabled }"
                @click="onDeckTap"
              >
                <span>Deck</span>
                <span>{{ biddingBoard.secondary.deckCount }}</span>
              </q-badge>
              <div v-if="biddingBoard.memoryAid.knownDeckCountHint !== null" class="text-caption text-grey-6 q-mt-xs">
                Known to you: {{ biddingBoard.memoryAid.knownDeckCountHint }}
              </div>
            </div>
            <div class="col-4">
              <q-badge color="grey-8" class="full-width q-py-xs" align="between">
                <span>Dungeon</span>
                <span>{{ biddingBoard.secondary.dungeonCount }}</span>
              </q-badge>
            </div>
            <div class="col-4">
              <q-badge :color="biddingBoard.heroCue.badgeColor" text-color="white" class="full-width q-py-xs" align="between">
                <span>Turn</span>
                <span>{{ biddingBoard.secondary.activeSeatId ?? '-' }}</span>
              </q-badge>
            </div>
          </div>
          <div class="row q-col-gutter-xs q-mt-xs">
            <div
              v-for="equipment in biddingBoard.secondary.equipment"
              :key="equipment.equipmentId"
              class="col-4 col-sm-3"
            >
              <q-badge class="full-width q-py-xs" :color="equipment.consumed ? 'grey-6' : 'indigo-7'">
                {{ equipment.equipmentId }}
              </q-badge>
            </div>
          </div>
        </q-card>

        <q-card flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Action</div>
          <div v-if="activePresentationLabel" class="text-body2 text-grey-6 q-mb-xs">{{ activePresentationLabel }}</div>
          <div v-if="!isHumanTurn" class="text-body2 text-grey-6">AI is taking its turn…</div>
          <div v-else class="row q-col-gutter-sm q-gutter-y-sm">
            <q-btn
              v-for="action in visibleLegalActions"
              :key="actionKey(action)"
              :color="biddingBoard.heroCue.buttonColor"
              unelevated
              no-caps
              :size="isMobile ? 'lg' : 'md'"
              class="col-12 col-sm-auto"
              :label="actionLabel(action)"
              :disable="gameplayInputLocked"
              @click="takeHumanAction(action)"
            />
          </div>
        </q-card>

        <q-card v-if="match.state.phase === 'dungeon' && dungeonEquipmentTokens.length" flat bordered class="q-pa-md q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Equipment tokens</div>
          <div class="row q-gutter-sm">
            <q-btn
              v-for="token in dungeonEquipmentTokens"
              :key="token.equipmentId"
              :label="token.label"
              unelevated
              color="grey-8"
              text-color="white"
              :class="{ 'dr-token-glow': token.glow }"
              :disable="!isHumanTurn || gameplayInputLocked || !token.hasModal"
              @click="openEquipmentModal(token)"
            />
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

    <button
      v-if="activePresentation?.kind === 'HERO_CHANGE_INTERSTITIAL'"
      type="button"
      class="dr-hero-interstitial"
      @click="skipActivePresentation"
    >
      <div class="dr-hero-interstitial__hero">{{ activePresentation?.payload?.heroAfter }}</div>
      <div class="dr-hero-interstitial__hint">Tap to skip</div>
    </button>

    <q-dialog v-model="resumeDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-sm">Resume previous match?</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn flat label="Start new" color="primary" @click="startFreshFromDialog" />
          <q-btn unelevated label="Resume" color="primary" @click="resumeFromDialog" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="equipmentModalOpen">
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">{{ selectedEquipmentModalView?.title }}</div>
        <div class="text-body2 q-mb-md">{{ selectedEquipmentModalView?.details }}</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn
            v-if="selectedEquipmentModalView?.showUseButton"
            color="primary"
            unelevated
            label="Use"
            @click="takeEquipmentUseAction"
          />
          <q-btn flat color="primary" label="Continue" @click="continueFromEquipmentModal" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="vorpalDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">Vorpal target</div>
        <div class="text-body2 q-mb-md">Choose a species before entering the dungeon.</div>
        <q-select
          v-model="selectedVorpalSpecies"
          :options="vorpalPromptView.speciesOptions"
          label="Species"
          behavior="menu"
          outlined
          dense
          class="q-mb-md"
        />
        <div class="row justify-end">
          <q-btn
            color="primary"
            unelevated
            label="Confirm"
            :disable="!selectedVorpalSpecies || gameplayInputLocked"
            @click="confirmVorpalDeclaration"
          />
        </div>
      </q-card>
    </q-dialog>
    <q-dialog v-model="historyDrawerOpen" position="bottom" maximized>
      <q-card class="dr-history-panel">
        <div class="row items-center q-px-md q-pt-md q-pb-sm">
          <div class="text-subtitle1">Match history</div>
          <q-space />
          <q-btn flat dense icon="close" aria-label="Close match history" @click="historyDrawerOpen = false" />
        </div>
        <q-separator />
        <div class="q-pa-md dr-history-scroll">
          <div v-if="historyPanelViewModel.entries.length === 0" class="text-body2 text-grey-6">
            {{ historyPanelViewModel.emptyStateLabel }}
          </div>
          <div v-else class="q-gutter-y-sm">
            <q-card v-for="(entry, index) in historyPanelViewModel.entries" :key="`history-${index}`" flat bordered class="q-pa-sm">
              <div class="text-body2">{{ entry.headline }}</div>
              <div class="text-caption text-grey-6">{{ entry.provenance }}</div>
            </q-card>
          </div>
        </div>
      </q-card>
    </q-dialog>
    <q-dialog v-model="deckSplayOpen" maximized>
      <q-card class="dr-deck-splay-panel">
        <div class="row items-center q-px-md q-pt-md q-pb-sm">
          <div class="text-subtitle1">Deck splay</div>
          <q-space />
          <q-btn flat dense icon="close" aria-label="Close deck splay" @click="onCloseDeckSplay" />
        </div>
        <q-separator />
        <div class="q-pa-md dr-deck-splay-scroll">
          <div class="row q-col-gutter-sm q-row-gutter-sm">
            <div v-for="(_, index) in biddingBoard.memoryAid.deckSplayCards" :key="`deck-card-${index}`" class="col-6 col-sm-4 col-md-3">
              <img class="dr-card-preview" :src="uiAssets.cards.monsterBack.runtimePath" alt="Hidden deck card" />
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
import { createPresentationOrchestrator } from '../../features/dungeon-runner/ui/presentationOrchestrator.js'
import { dungeonRunnerAssetPack } from '../../features/dungeon-runner/ui/assetPack.js'
import {
  buildDungeonEquipmentTokenView,
  createDungeonEquipmentModalView,
  createVorpalDeclarationPromptView,
  pickAutoResolveDungeonAction,
} from '../../features/dungeon-runner/ui/dungeonEquipmentInteractions.js'
import { createBiddingBoardViewModel } from '../../features/dungeon-runner/ui/biddingBoardViewModel.js'
import MonsterCardFace from '../../components/dungeon-runner/MonsterCardFace.vue'
import { buildHistoryPanelViewModel } from '../../features/dungeon-runner/ui/historyPanelViewModel.js'
import { closeDeckSplay, createMemoryAidState, setMemoryAidEnabled, tapDeck } from '../../features/dungeon-runner/ui/memoryAidState.js'

const setup = reactive(createDefaultSetupConfig())
const $q = useQuasar()
const match = ref(null)
const historyDrawerOpen = ref(false)
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
const presentationOrchestrator = createPresentationOrchestrator()
const activePresentation = ref(null)
const activePresentationLabel = ref('')
const equipmentModalOpen = ref(false)
const selectedEquipmentTokenId = ref(null)
const vorpalDialogOpen = ref(false)
const selectedVorpalSpecies = ref(null)
const memoryAidState = ref(createMemoryAidState())
let presentationTimerId = null
let aiTurnTimerId = null
let autoResolveTimerId = null
const uiAssets = dungeonRunnerAssetPack

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
const visibleLegalActions = computed(() => legalActions.value.filter((action) => action.type !== 'DECLARE_VORPAL'))
const gameplayInputLocked = computed(() => presentationOrchestrator.isGameplayInputLocked())
const visibleState = computed(() => {
  if (!match.value || !humanSeatId.value) return null
  return getPlayerView(match.value.state, { seatId: humanSeatId.value })
})
const dungeonEquipmentTokens = computed(() =>
  buildDungeonEquipmentTokenView({
    inPlayEquipmentIds: visibleState.value?.dungeon?.inPlayEquipmentIds ?? [],
    legalActions: legalActions.value,
  }),
)
const selectedEquipmentModalView = computed(() => {
  if (!selectedEquipmentTokenId.value) return null
  return createDungeonEquipmentModalView({
    equipmentId: selectedEquipmentTokenId.value,
    legalActions: legalActions.value,
  })
})
const vorpalPromptView = computed(() =>
  createVorpalDeclarationPromptView({
    isHumanTurn: isHumanTurn.value,
    gameplayInputLocked: gameplayInputLocked.value,
    phase: match.value?.state?.phase ?? null,
    subphase: match.value?.state?.dungeon?.subphase ?? null,
    legalActions: legalActions.value,
  }),
)
const biddingBoard = computed(() =>
  createBiddingBoardViewModel({
    state: match.value?.state ?? null,
    visibleState: visibleState.value,
    activeAnimation: activePresentation.value,
    viewerSeatId: humanSeatId.value,
    settings: {
      memoryAidEnabled: memoryAidState.value.enabled,
    },
  }),
)
const deckSplayOpen = computed({
  get() {
    return memoryAidState.value.deckSplayOpen
  },
  set(open) {
    memoryAidState.value = open ? tapDeck(memoryAidState.value) : closeDeckSplay(memoryAidState.value)
  },
})
const historyPanelViewModel = computed(() =>
  buildHistoryPanelViewModel({
    historyEntries: match.value?.state?.history ?? [],
    seats: match.value?.state?.seats ?? [],
    isOpen: historyDrawerOpen.value,
  }),
)
const isMobile = computed(() => $q.screen.lt.md)
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
  presentationTimerId = window.setInterval(() => {
    presentationOrchestrator.advance(50)
    syncPresentationLabel()
    scheduleAiTurnIfReady()
  }, 50)
})

onBeforeUnmount(() => {
  if (presentationTimerId) window.clearInterval(presentationTimerId)
  if (aiTurnTimerId) window.clearTimeout(aiTurnTimerId)
  if (autoResolveTimerId) window.clearTimeout(autoResolveTimerId)
})

watch(
  () => match.value?.state,
  (state) => {
    if (!match.value || !state) return
    persistCurrentMatch(window.localStorage, match.value)
    scheduleAiTurnIfReady()
    scheduleHumanAutoResolveIfReady()
  },
  { deep: true },
)

watch(
  () => vorpalPromptView.value.open,
  (open) => {
    if (!open) {
      vorpalDialogOpen.value = false
      selectedVorpalSpecies.value = null
      return
    }
    vorpalDialogOpen.value = true
    const firstSpecies = vorpalPromptView.value.speciesOptions[0] ?? null
    if (!selectedVorpalSpecies.value || !vorpalPromptView.value.speciesOptions.includes(selectedVorpalSpecies.value)) {
      selectedVorpalSpecies.value = firstSpecies
    }
  },
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
  historyDrawerOpen.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  syncPresentationLabel()
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
  historyDrawerOpen.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  syncPresentationLabel()
}

function backToSetup() {
  match.value = null
  historyDrawerOpen.value = false
  clearCurrentMatch(window.localStorage)
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  syncPresentationLabel()
}

function takeHumanAction(action) {
  if (!match.value || !humanSeatId.value || gameplayInputLocked.value) return
  if (equipmentModalOpen.value) equipmentModalOpen.value = false
  const prevState = match.value.state
  const result = applyAction(prevState, action, { seatId: humanSeatId.value })
  if (!result.ok) return
  match.value = { ...match.value, state: result.state }
  enqueuePresentationTransition(prevState, result.state, action, humanSeatId.value, 'human')
}

function onMemoryAidToggle(enabled) {
  memoryAidState.value = setMemoryAidEnabled(memoryAidState.value, enabled === true)
}

function onDeckTap() {
  memoryAidState.value = tapDeck(memoryAidState.value)
}

function onCloseDeckSplay() {
  memoryAidState.value = closeDeckSplay(memoryAidState.value)
}

function openEquipmentModal(token) {
  if (!token.hasModal || gameplayInputLocked.value || !isHumanTurn.value) return
  selectedEquipmentTokenId.value = token.equipmentId
  equipmentModalOpen.value = true
}

function takeEquipmentUseAction() {
  if (!selectedEquipmentModalView.value?.useAction) return
  const shouldSpend = window.confirm(selectedEquipmentModalView.value.confirmUseMessage)
  if (!shouldSpend) return
  takeHumanAction(selectedEquipmentModalView.value.useAction)
}

function continueFromEquipmentModal() {
  if (selectedEquipmentModalView.value?.continueAction) {
    takeHumanAction(selectedEquipmentModalView.value.continueAction)
    return
  }
  equipmentModalOpen.value = false
}

function confirmVorpalDeclaration() {
  if (!selectedVorpalSpecies.value) return
  takeHumanAction({
    type: 'DECLARE_VORPAL',
    species: selectedVorpalSpecies.value,
  })
}

async function runAiTurn() {
  if (!match.value || (match.value.state.phase !== 'bidding' && match.value.state.phase !== 'dungeon')) return
  const seatId = match.value.state.turn.activeSeatId
  if (!seatId || seatId === humanSeatId.value) return
  if (debugMode.value) {
    console.log('[DungeonRunner][AITurn][Start]', {
      phase: match.value.state.phase,
      seatId,
      humanSeatId: humanSeatId.value,
      turnNumber: match.value.state.turn.turnNumber,
    })
  }
  const seat = match.value.state.seats.find((candidate) => candidate.id === seatId)
  const roleType = seat?.role?.type
  let action = null
  if (roleType === 'nn') {
    const modelId = seat.role.modelId ?? 'latest'
    if (debugMode.value) console.log('[DungeonRunner][AITurn][NN]', { seatId, modelId })
    if (nnFailureRecovery.isCoolingDown(modelId)) {
      action = chooseRandombotAction(match.value.state, { seatId })
    } else {
      action = await chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(modelId))
      if (action?.meta?.fallbackReason === 'MODEL_LOAD_FAILED') {
        action = await handleNnModelFailure(seat, modelId, seatId, action)
      }
    }
  } else {
    if (debugMode.value) console.log('[DungeonRunner][AITurn][Randombot]', { seatId })
    action = chooseRandombotAction(match.value.state, { seatId })
  }
  if (debugMode.value) console.log('[DungeonRunner][AITurn][Action]', { seatId, action })
  if (!action) return
  const prevState = match.value.state
  const result = applyAction(prevState, action, { seatId })
  if (!result.ok) return
  match.value = { ...match.value, state: result.state }
  enqueuePresentationTransition(prevState, result.state, action, seatId, roleType ?? 'randombot')
}

function enqueuePresentationTransition(prevState, nextState, action, actorSeatId, actorRoleType) {
  presentationOrchestrator.enqueueEngineTransition({
    phaseBefore: prevState.phase,
    phaseAfter: nextState.phase,
    turnBeforeSeatId: prevState.turn.activeSeatId,
    turnAfterSeatId: nextState.turn.activeSeatId,
    dungeonRunResult:
      prevState.lastDungeonRun?.result === nextState.lastDungeonRun?.result ? null : nextState.lastDungeonRun?.result ?? null,
    action,
    actorSeatId,
    actorRoleType,
    centerEquipmentBefore: prevState.centerEquipment ?? [],
    centerEquipmentAfter: nextState.centerEquipment ?? [],
    heroBefore: prevState.hero,
    heroAfter: nextState.hero,
  })
  syncPresentationLabel()
}

function syncPresentationLabel() {
  activePresentation.value = presentationOrchestrator.getActiveAnimation()
  activePresentationLabel.value = activePresentation.value?.label ?? ''
}

function scheduleAiTurnIfReady() {
  if (!match.value || gameplayInputLocked.value || isHumanTurn.value) return
  if (match.value.state.phase !== 'bidding' && match.value.state.phase !== 'dungeon') return
  if (aiTurnTimerId) return
  aiTurnTimerId = window.setTimeout(() => {
    aiTurnTimerId = null
    void runAiTurn()
  }, 200)
}

function scheduleHumanAutoResolveIfReady() {
  if (!match.value || gameplayInputLocked.value || !isHumanTurn.value) return
  if (match.value.state.phase !== 'dungeon') return
  if (equipmentModalOpen.value || autoResolveTimerId) return
  const action = pickAutoResolveDungeonAction({ legalActions: legalActions.value })
  if (!action) return
  autoResolveTimerId = window.setTimeout(() => {
    autoResolveTimerId = null
    takeHumanAction(action)
  }, 220)
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
  if (action.type === 'DECLARE_VORPAL') return `Declare ${action.species}`
  if (action.type === 'ADVANCE_DUNGEON') return 'Run dungeon'
  return action.type
}

function actionKey(action) {
  return `${action.type}-${action.equipmentId ?? ''}`
}

function skipActivePresentation() {
  presentationOrchestrator.skipActiveAnimation()
  syncPresentationLabel()
}

function resumeFromDialog() {
  const loaded = loadCurrentMatch(window.localStorage)
  if (!loaded.ok) {
    resumeDialogOpen.value = false
    return
  }
  match.value = loaded.match
  presentationOrchestrator.clear()
  syncPresentationLabel()
  resumeDialogOpen.value = false
}

function startFreshFromDialog() {
  clearCurrentMatch(window.localStorage)
  presentationOrchestrator.clear()
  syncPresentationLabel()
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
    historyDrawerOpen.value = true
    presentationOrchestrator.clear()
    syncPresentationLabel()
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

.dr-bidding-board {
  background-image: url('/assets/dungeon-runner/runtime/board/bidding-texture.png');
  background-size: cover;
}

.dr-board-primary {
  display: flex;
  justify-content: center;
}

.dr-card-preview {
  width: 100%;
  max-width: 140px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
}

.dr-card-preview--hero {
  max-width: 220px;
}

.dr-token-glow {
  box-shadow: 0 0 0 1px rgba(255, 193, 7, 0.65), 0 0 16px rgba(255, 193, 7, 0.5);
}

.dr-history-panel {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.dr-history-scroll {
  overflow-y: auto;
}

.dr-deck-badge {
  user-select: none;
}

.dr-deck-badge--interactive {
  cursor: pointer;
}

.dr-deck-splay-panel {
  width: min(960px, 100vw);
  height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.dr-deck-splay-scroll {
  overflow-y: auto;
}

.dr-hero--warrior {
  box-shadow: inset 0 0 0 2px rgba(63, 81, 181, 0.45);
}

.dr-hero--barbarian {
  box-shadow: inset 0 0 0 2px rgba(255, 87, 34, 0.5);
}

.dr-hero--mage {
  box-shadow: inset 0 0 0 2px rgba(103, 58, 183, 0.5);
}

.dr-hero--rogue {
  box-shadow: inset 0 0 0 2px rgba(0, 150, 136, 0.5);
}

.dr-hero-interstitial {
  position: fixed;
  inset: 0;
  border: 0;
  width: 100%;
  background: rgba(12, 12, 18, 0.9);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  z-index: 20;
  cursor: pointer;
}

.dr-hero-interstitial__hero {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.dr-hero-interstitial__hint {
  font-size: 0.85rem;
  opacity: 0.75;
}
</style>
