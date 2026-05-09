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
        icon="settings"
        aria-label="Match settings"
        :disable="dungeonOutcomeDialogOpen"
      >
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <div class="dr-match-settings-menu q-pa-md" style="min-width: 260px">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Match presentation</div>
            <div class="text-caption text-grey-6 q-mb-md">Animation pace (default: cinematic).</div>
            <q-option-group
              v-model="presentationSpeedProfile"
              :options="presentationSpeedOptions"
              color="primary"
              type="radio"
            />
            <q-separator class="q-my-md" />
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Match recall</div>
            <div class="text-caption text-grey-6 q-mb-sm">
              Memory Aid is off by default. When on, deck splay, bidding counts, and Vorpal pile hints apply immediately.
            </div>
            <q-toggle
              :model-value="memoryAidState.enabled"
              dense
              label="Memory Aid"
              aria-label="Toggle memory aid"
              @update:model-value="onMemoryAidToggle"
            />
          </div>
        </q-menu>
      </q-btn>
      <q-btn
        v-if="match"
        flat
        round
        dense
        size="md"
        icon="history"
        color="grey-7"
        aria-label="Open match history"
        :disable="dungeonOutcomeDialogOpen"
        @click="historyDrawerOpen = true"
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
        <div ref="boardShellRef" class="dr-board-shell">
          <q-card
            flat
            bordered
            class="q-pa-sm q-mb-sm dr-bidding-board"
            :class="biddingBoard.heroCue.accentClass"
          >
          <div class="text-subtitle2 q-mb-xs">Bidding board</div>
          <div
            v-if="match.state.phase === 'bidding' && biddingBoard.secondary.seats.length"
            class="dr-seat-strip row q-col-gutter-xs q-mb-xs"
          >
            <div v-for="row in biddingBoard.secondary.seats" :key="row.seatId" class="col-auto">
              <q-badge
                outline
                :color="row.isActive ? 'amber-8' : 'grey-7'"
                :text-color="row.isActive ? 'black' : 'white'"
                class="dr-seat-chip q-px-sm"
              >
                <span class="text-caption">{{ row.label }}</span>
                <span class="text-caption q-ml-xs">{{ row.passed ? '· Out' : '· In' }}</span>
                <q-avatar v-if="row.isActive" square size="14px" class="q-ml-xs">
                  <img :src="uiAssets.counters.turn.runtimePath" alt="" />
                </q-avatar>
              </q-badge>
            </div>
          </div>
          <q-card-section class="q-pa-none q-mb-sm dr-board-primary">
            <div
              class="dr-hero-card-slot"
              :class="{
                'dr-dungeon-stage': showDungeonStage,
                [dungeonStageAnimationClass]: showDungeonStage && dungeonStageAnimationClass,
              }"
            >
              <div ref="dungeonCardMotionWrap" class="dr-dungeon-card-motion-wrap">
                <MonsterCardFace
                  ref="dungeonCardFaceRef"
                  class="dr-hero-card-control"
                  :species="
                    showDungeonStage
                      ? dungeonStageView.monster.frontFaceSpecies
                      : biddingBoard.primaryCard.variant === 'revealed'
                        ? biddingBoard.primaryCard.monsterCard
                        : null
                  "
                  :face-down="
                    showDungeonStage
                      ? dungeonStageView.monster.visibility !== 'revealed'
                      : biddingBoard.primaryCard.variant !== 'revealed'
                  "
                />
              </div>
              <q-badge
                v-if="showDungeonStage && dungeonStageView.hpDelta"
                class="dr-dungeon-stage__hp-chip"
                :color="dungeonStageView.hpDelta.tone === 'damage' ? 'negative' : 'positive'"
                text-color="white"
              >
                {{ dungeonStageView.hpDelta.text }}
              </q-badge>
            </div>
          </q-card-section>
          <div class="row q-col-gutter-xs items-start">
            <div class="col-4">
              <q-badge
                ref="deckBadgeRef"
                text-color="white"
                class="full-width q-py-xs justify-between dr-deck-badge dr-pile-badge dr-pile-badge--deck"
                :style="{ '--dr-pile': `url('${uiAssets.piles.deck.runtimePath}')` }"
                :class="{
                  'dr-deck-badge--interactive': biddingBoard.memoryAid.deckTapEnabled,
                }"
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
              <q-badge
                text-color="white"
                class="full-width q-py-xs justify-between dr-pile-badge dr-pile-badge--dungeon"
                :style="{ '--dr-pile': `url('${uiAssets.piles.dungeon.runtimePath}')` }"
              >
                <span>Dungeon</span>
                <span>{{ biddingBoard.secondary.dungeonCount }}</span>
              </q-badge>
            </div>
            <div class="col-4">
              <div class="row no-wrap items-center full-width dr-turn-hero-row">
                <q-avatar
                  :color="biddingBoard.heroCue.badgeColor"
                  text-color="white"
                  size="28px"
                  font-size="11px"
                  :aria-label="biddingBoard.heroCue.shortLabel"
                >
                  {{ biddingBoard.heroCue.badgeGlyph }}
                </q-avatar>
                <q-badge outline color="grey-7" text-color="grey-1" class="col q-py-xs justify-between">
                  <span>Turn</span>
                  <span>{{ biddingBoard.secondary.activeSeatLabel ?? '—' }}</span>
                </q-badge>
              </div>
            </div>
          </div>
          <div class="row q-col-gutter-xs q-mt-xs">
            <div
              v-for="token in boardEquipmentTokens"
              :key="token.equipmentId"
              class="col-4 col-sm-3"
            >
              <q-badge
                :ref="(el) => bindBiddingEquipmentBadgeRef(token.equipmentId, el)"
                class="full-width q-py-xs row items-center justify-center q-gutter-x-xs dr-equip-badge"
                :class="{
                  'dr-equip-badge--spent': token.removed,
                  'dr-token-glow': token.glow,
                  'dr-token-pulse': token.pulse,
                  'dr-equip-badge--deemphasized': token.deemphasized,
                  'dr-equip-badge--interactive': token.hasModal,
                }"
                :color="token.removed ? 'grey-6' : biddingBoard.heroCue.buttonColor"
                @click="openEquipmentModal(token)"
              >
                <img
                  class="dr-equip-icon"
                  :src="uiAssets.equipment[token.equipmentId].runtimePath"
                  :alt="''"
                  width="22"
                  height="22"
                />
                <span>{{ token.label }}</span>
              </q-badge>
            </div>
          </div>
        </q-card>

        <q-card flat bordered class="q-pa-sm q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Action</div>
          <div v-if="activePresentationLabel" class="text-body2 text-grey-6 q-mb-xs">{{ activePresentationLabel }}</div>
          <div v-if="isHumanTurn" class="row q-col-gutter-sm q-gutter-y-sm">
            <template v-if="match.state.phase === 'bidding' && biddingSacrificeActions.length > 1">
              <q-btn
                v-for="action in biddingNonSacrificeActions"
                :key="actionKey(action)"
                :color="biddingBoard.heroCue.buttonColor"
                unelevated
                no-caps
                :size="isMobile ? 'lg' : 'md'"
                class="col-12 col-sm-auto"
                :label="actionLabel(action)"
                :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
                @click="takeHumanAction(action)"
              />
              <q-btn-dropdown
                :color="biddingBoard.heroCue.buttonColor"
                unelevated
                no-caps
                :size="isMobile ? 'lg' : 'md'"
                class="col-12 col-sm-auto"
                label="Sacrifice equipment"
                :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
              >
                <q-list dense>
                  <q-item
                    v-for="action in biddingSacrificeActions"
                    :key="actionKey(action)"
                    v-close-popup
                    clickable
                    @click="takeHumanAction(action)"
                  >
                    <q-item-section>{{ actionLabel(action) }}</q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </template>
            <template v-else>
              <q-btn
                v-for="action in visibleLegalActions"
                :key="actionKey(action)"
                :color="biddingBoard.heroCue.buttonColor"
                unelevated
                no-caps
                :size="isMobile ? 'lg' : 'md'"
                class="col-12 col-sm-auto"
                :label="actionLabel(action)"
                :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
                @click="takeHumanAction(action)"
              />
            </template>
          </div>
          <div v-if="isHumanTurn && dungeonOutcomeTransitionControls.length" class="row q-col-gutter-sm q-gutter-y-sm q-mt-xs">
            <q-btn
              v-for="control in dungeonOutcomeTransitionControls"
              :key="control.key"
              :color="biddingBoard.heroCue.buttonColor"
              unelevated
              no-caps
              :size="isMobile ? 'lg' : 'md'"
              class="col-12 col-sm-auto"
              :label="control.label"
              :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
              @click="takeHumanAction(control.action)"
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

          <q-card v-if="match.state.phase === 'match-over'" flat bordered class="q-pa-md">
            <div class="text-subtitle1 q-mb-sm">Bidding complete</div>
            <div class="text-body2 q-mb-md">Runner: {{ runnerLabel }}</div>
            <div class="row q-gutter-sm">
              <q-btn color="primary" unelevated label="Rematch" @click="rematch" />
              <q-btn flat color="primary" label="Back to setup" @click="backToSetup" />
            </div>
          </q-card>
          <div
            ref="presentationFlightLayerRef"
            class="dr-presentation-flight-layer"
            aria-hidden="true"
          />
        </div>
      </template>
    </div>

    <button
      v-if="activePresentation?.kind === 'HERO_CHANGE_INTERSTITIAL' && heroChangeInterstitialView"
      ref="heroChangeInterstitialOverlayRef"
      type="button"
      class="dr-hero-interstitial"
      :aria-label="heroChangeInterstitialAriaLabel"
      @click="skipActivePresentation"
    >
      <div class="dr-hero-interstitial__transition row items-center no-wrap">
        <template v-if="heroChangeInterstitialView.showBefore">
          <q-avatar
            :color="heroChangeInterstitialView.before.badgeColor"
            text-color="white"
            size="56px"
            font-size="1.25rem"
            class="dr-hero-interstitial__avatar dr-hero-interstitial__avatar--from"
          >
            {{ heroChangeInterstitialView.before.badgeGlyph }}
          </q-avatar>
          <span class="dr-hero-interstitial__arrow" aria-hidden="true">→</span>
        </template>
        <q-avatar
          :color="heroChangeInterstitialView.after.badgeColor"
          text-color="white"
          size="56px"
          font-size="1.25rem"
          class="dr-hero-interstitial__avatar dr-hero-interstitial__avatar--to"
        >
          {{ heroChangeInterstitialView.after.badgeGlyph }}
        </q-avatar>
      </div>
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

    <q-dialog v-model="dungeonOutcomeDialogOpen" persistent>
      <q-card class="q-pa-md dr-dungeon-outcome-dialog" style="min-width: 340px">
        <div class="text-overline text-grey-6">Dungeon run resolved</div>
        <div class="text-h5 text-weight-bold q-mb-sm">
          {{ dungeonOutcomeSummary?.resultLabel }}
        </div>
        <div class="text-body1 q-mb-xs">
          Runner: <span class="text-weight-medium">{{ dungeonOutcomeSummary?.runnerLabel }}</span>
        </div>
        <div class="text-body2 q-mb-xs">Monsters: {{ dungeonOutcomeSummary?.monstersLabel }}</div>
        <div class="text-body2 q-mb-md">Equipment: {{ dungeonOutcomeSummary?.equipmentSpentLabel }}</div>
        <div class="row justify-end">
          <q-btn color="primary" unelevated label="Continue" @click="continueFromDungeonOutcome" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="equipmentModalOpen" class="dr-equipment-dialog">
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
          :options="vorpalSelectOptions"
          emit-value
          map-options
          option-value="value"
          option-label="label"
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
            <div
              v-for="(slot, index) in biddingBoard.memoryAid.deckSplayCards"
              :key="`deck-card-${index}`"
              class="col-6 col-sm-4 col-md-3"
            >
              <MonsterCardFace
                class="dr-card-preview"
                :species="slot.visibility === 'face' ? slot.species : null"
                :face-down="slot.visibility !== 'face'"
              />
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, triggerRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  MATCH_PHASES,
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
import { createPresentationOrchestrator } from '../../features/dungeon-runner/ui/presentationOrchestrator.js'
import {
  DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS,
  runPresentationIntervalTick,
} from '../../features/dungeon-runner/ui/dungeonRunnerPresentationInterval.js'
import { dungeonRunnerAssetPack } from '../../features/dungeon-runner/ui/assetPack.js'
import { equipmentShortName } from '../../features/dungeon-runner/ui/equipmentDisplayCatalog.js'
import { legalActionBoardLabel } from '../../features/dungeon-runner/ui/dungeonRunnerPlayerPhrasing.js'
import {
  buildDungeonEquipmentTokenView,
  createDungeonEquipmentModalView,
  createVorpalDeclarationPromptView,
  filterVisibleLegalActions,
} from '../../features/dungeon-runner/ui/dungeonEquipmentInteractions.js'
import { createBiddingBoardViewModel } from '../../features/dungeon-runner/ui/biddingBoardViewModel.js'
import { getHeroIdentity } from '../../features/dungeon-runner/ui/heroIdentity.js'
import { createDungeonResolutionViewModel } from '../../features/dungeon-runner/ui/dungeonResolutionViewModel.js'
import {
  buildDungeonOutcomeTransitionControls,
  dungeonStageClassForKind,
  shouldExecuteScheduledAutoResolve,
  shouldAutoResolveDungeonAdvance,
} from '../../features/dungeon-runner/ui/dungeonResolutionFlow.js'
import {
  buildDungeonOutcomeSummary,
  isDungeonOutcomeDialogOpen,
} from '../../features/dungeon-runner/ui/dungeonOutcomeDialog.js'
import MonsterCardFace from '../../components/dungeon-runner/MonsterCardFace.vue'
import { buildHistoryPanelViewModel } from '../../features/dungeon-runner/ui/historyPanelViewModel.js'
import { closeDeckSplay, createMemoryAidState, setMemoryAidEnabled, tapDeck } from '../../features/dungeon-runner/ui/memoryAidState.js'
import { isDungeonPresentationTraceEnabled } from '../../features/dungeon-runner/ui/dungeonPresentationTrace.js'
import { usePresentationMotion } from '../../features/dungeon-runner/ui/usePresentationMotion.js'

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
function presentationTraceEnabled() {
  return isDungeonPresentationTraceEnabled()
}
const modelOptions = ref([])
const nnFailureRecovery = createModelFailureRecovery()
const replayImportText = ref('')
const replayExportText = ref('')
const nnDebugTraceText = ref('')
const nnDebugTraceHistory = ref([])
const presentationOrchestrator = createPresentationOrchestrator()
const presentationSpeedProfile = ref('cinematic')
const presentationSpeedOptions = [
  { label: 'Cinematic', value: 'cinematic' },
  { label: 'Brisk', value: 'brisk' },
]
const activePresentation = ref(null)
const boardShellRef = ref(null)
const dungeonCardMotionWrap = ref(null)
const dungeonCardFaceRef = ref(null)
const deckBadgeRef = ref(null)
const heroChangeInterstitialOverlayRef = ref(null)
const presentationFlightLayerRef = ref(null)
const biddingEquipmentBadgeRefs = reactive({})

function domEl(componentOrEl) {
  if (!componentOrEl) return null
  if (componentOrEl.nodeType === 1) return componentOrEl
  const inner = componentOrEl.$el
  return inner?.nodeType === 1 ? inner : null
}

function bindBiddingEquipmentBadgeRef(equipmentId, componentOrEl) {
  const node = domEl(componentOrEl)
  if (node) biddingEquipmentBadgeRefs[equipmentId] = node
  else delete biddingEquipmentBadgeRefs[equipmentId]
}

// GSAP: most beats tween `boardShell` (shared placeholder) plus kind-specific refs — `DUNGEON_REVEAL` tweens `dungeonCardWrap` (opacity / y / scale) and `dungeonCardFlipAxis` (`rotationY` flip); damage / neutralize / continue use `dungeonCardWrap` + shell; `DUNGEON_OUTCOME` tweens the wrap only (no shell tween); teardown clears wrap + shell after that beat for neutral baseline (#66).
// `HERO_CHANGE_INTERSTITIAL` → overlay only; bot bidding → `dungeonCardWrap` / `deckBadge` / equipment; neutralize + sacrifice use `presentationFlightLayer` + `equipment_*` (see presentationMotionRegistry.js).
// Window resize during fragile motion (ghost flight #68, or dungeon reveal flip) swaps to shell+card-only tweens for the rest of that beat (#71); orchestrator `remainingMs` is not recomputed on resize (#68).
usePresentationMotion({
  activePresentation,
  getMotionRefs: (head) => {
    if (head?.kind === 'HERO_CHANGE_INTERSTITIAL') {
      return {
        heroChangeInterstitialOverlay: heroChangeInterstitialOverlayRef.value,
        boardShell: boardShellRef.value,
      }
    }
    const base = {
      boardShell: boardShellRef.value,
      dungeonCardWrap: dungeonCardMotionWrap.value,
      dungeonCardFlipAxis: dungeonCardFaceRef.value?.dungeonCardFlipAxis ?? null,
      deckBadge: domEl(deckBadgeRef.value),
      presentationFlightLayer: presentationFlightLayerRef.value,
    }
    if (head?.kind !== 'BOT_BIDDING_SACRIFICE' && head?.kind !== 'DUNGEON_NEUTRALIZE') return base
    const ids = head?.payload?.consumedEquipmentIds ?? []
    const extra = {}
    for (const id of ids) {
      const node = biddingEquipmentBadgeRefs[id]
      if (node?.nodeType === 1) extra[`equipment_${id}`] = node
    }
    return { ...base, ...extra }
  },
})
const activePresentationLabel = ref('')
const equipmentModalOpen = ref(false)
const selectedEquipmentTokenId = ref(null)
const vorpalDialogOpen = ref(false)
const selectedVorpalSpecies = ref(null)
const memoryAidState = ref(createMemoryAidState())
const previousVisibleState = ref(null)
const dismissedDungeonRun = ref(null)
const equipmentRemainingAtResolution = ref(null)
const deferredPostDungeonState = ref(null)
let presentationTimerId = null
let aiTurnTimerId = null
let autoResolveTimerId = null
let aiTurnInFlight = false
let lastPresentationTraceKey = null
const uiAssets = dungeonRunnerAssetPack

watch(presentationSpeedProfile, (next) => {
  presentationOrchestrator.setSpeedProfile(next)
  syncPresentationLabel()
  triggerRef(activePresentation)
  if (match.value) {
    match.value = { ...match.value, presentationSpeedProfile: next }
    persistCurrentMatch(window.localStorage, match.value)
  }
})

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
const visibleLegalActions = computed(() =>
  filterVisibleLegalActions({
    phase: match.value?.state?.phase ?? null,
    legalActions: legalActions.value,
  }),
)
const biddingSacrificeActions = computed(() => visibleLegalActions.value.filter((a) => a.type === 'SACRIFICE'))
const biddingNonSacrificeActions = computed(() => visibleLegalActions.value.filter((a) => a.type !== 'SACRIFICE'))
const gameplayInputLocked = ref(false)
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
const dungeonResolutionView = computed(() =>
  createDungeonResolutionViewModel({
    visibleState: visibleState.value ?? {},
    previousVisibleState: previousVisibleState.value ?? {},
    legalActions: legalActions.value,
    activeAnimation: activePresentation.value,
  }),
)
const showDungeonStage = computed(() => {
  if (match.value?.state?.phase === 'dungeon') return true
  return isDungeonPresentationKind(activePresentation.value?.kind ?? null)
})
const dungeonStageView = computed(() =>
  createDungeonResolutionViewModel({
    visibleState: (match.value?.state?.phase === 'dungeon' ? visibleState.value : previousVisibleState.value) ?? {},
    previousVisibleState: previousVisibleState.value ?? {},
    legalActions: legalActions.value,
    activeAnimation: activePresentation.value,
  }),
)
const dungeonStageAnimationClass = computed(() => dungeonStageClassForKind(activePresentation.value?.kind ?? null))
const dungeonOutcomeTransitionControls = computed(() =>
  buildDungeonOutcomeTransitionControls({
    phase: match.value?.state?.phase ?? null,
    gameplayInputLocked: gameplayInputLocked.value,
    resolutionStatus: dungeonResolutionView.value.resolutionStatus,
    autoAdvanceAction: dungeonResolutionView.value.autoAdvanceAction,
  }),
)
const actionableEquipmentIds = computed(() => new Set(dungeonResolutionView.value.highlightedEquipmentIds))
const boardEquipmentTokens = computed(() => {
  const dungeonTokenById = new Map(dungeonEquipmentTokens.value.map((token) => [token.equipmentId, token]))
  const isDungeonPhase = match.value?.state?.phase === 'dungeon'
  const hasActionable = actionableEquipmentIds.value.size > 0
  return biddingBoard.value.secondary.equipment.map((equipment) => {
    const dungeonToken = dungeonTokenById.get(equipment.equipmentId)
    const removed = equipment.removed || equipment.consumed
    const actionable = isDungeonPhase && actionableEquipmentIds.value.has(equipment.equipmentId)
    return {
      equipmentId: equipment.equipmentId,
      label: equipmentShortName(equipment.equipmentId),
      removed,
      glow: isDungeonPhase ? (dungeonToken?.glow ?? false) : false,
      pulse: actionable,
      deemphasized: isDungeonPhase && hasActionable && !actionable && !removed,
      canUseNow: dungeonToken?.canUseNow ?? false,
      hasModal: !removed,
    }
  })
})
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
    memoryAidEnabled: memoryAidState.value.enabled,
    viewerOwnPileAdds: visibleState.value?.playerOwnPileAdds?.[humanSeatId.value ?? ''] ?? [],
  }),
)
const vorpalSelectOptions = computed(() => {
  const pv = vorpalPromptView.value
  const counts = pv.vorpalSpeciesOwnPileCounts
  return pv.speciesOptions.map((species) => {
    const n = counts?.[species] ?? 0
    const label = n > 0 ? `${species} (${n})` : species
    return { label, value: species }
  })
})
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
const heroChangeInterstitialView = computed(() => {
  if (activePresentation.value?.kind !== 'HERO_CHANGE_INTERSTITIAL') return null
  const payload = activePresentation.value?.payload
  if (!payload?.heroAfter) return null
  const before = getHeroIdentity(payload.heroBefore)
  const after = getHeroIdentity(payload.heroAfter)
  return {
    before,
    after,
    showBefore: before.hero !== after.hero,
  }
})
const heroChangeInterstitialAriaLabel = computed(() => {
  const v = heroChangeInterstitialView.value
  if (!v) return ''
  if (v.showBefore) return `Hero: ${v.before.shortLabel} to ${v.after.shortLabel}`
  return `Hero: ${v.after.shortLabel}`
})
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
const dungeonOutcomeSummary = computed(() =>
  buildDungeonOutcomeSummary({
    lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
    seats: match.value?.state?.seats ?? [],
    equipmentRemainingAtResolution: equipmentRemainingAtResolution.value,
  }),
)
const dungeonOutcomeDialogOpen = computed({
  get() {
    return (
      !gameplayInputLocked.value &&
      isDungeonOutcomeDialogOpen({
      lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
      dismissedDungeonRun: dismissedDungeonRun.value,
    })
    )
  },
  set(open) {
    if (open) return
    continueFromDungeonOutcome()
  },
})
const runnerLabel = computed(() => {
  if (!match.value) return ''
  const runner = match.value.state.seats.find((seat) => seat.id === match.value.state.bidding.runnerSeatId)
  return runner?.label ?? 'Unknown'
})

onMounted(() => {
  debugMode.value = shouldEnableDebugOnBoot(window.location.href)
  if (presentationTraceEnabled()) {
    console.log(
      '[DungeonRunner][presentation] trace on — localStorage.setItem("dungeonPresentationTrace","1")',
    )
  }
  if (decideResumeFlow(window.localStorage).mode === 'resume-or-start-new') {
    resumeDialogOpen.value = true
  }
  void loadModelCatalog()
  presentationTimerId = window.setInterval(() => {
    runPresentationIntervalTick(presentationOrchestrator, DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS, {
      syncPresentationLabel,
      scheduleAiTurnIfReady,
      scheduleHumanAutoResolveIfReady,
    })
  }, DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS)
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
  () => match.value?.state?.lastDungeonRun ?? null,
  (run) => {
    if (!run) {
      dismissedDungeonRun.value = null
      equipmentRemainingAtResolution.value = null
      return
    }
    const center = match.value?.state?.centerEquipment
    equipmentRemainingAtResolution.value = Array.isArray(center) ? center.length : 0
  },
  { immediate: true },
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
  const firstSeatId = shuffledState.turn.activeSeatId
  const initialPickState = {
    ...shuffledState,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    hero: null,
    pickAdventurer: {
      ...shuffledState.pickAdventurer,
      activeSeatId: firstSeatId,
    },
  }
  match.value = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id,
    setup: setupSnapshot,
    state: initialPickState,
    history: [],
    presentationSpeedProfile: 'cinematic',
  }
  deferredPostDungeonState.value = null
  historyDrawerOpen.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationSpeedProfile.value = 'cinematic'
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
  const firstSeatId = shuffledState.turn.activeSeatId
  const initialPickState = {
    ...shuffledState,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    hero: null,
    pickAdventurer: {
      ...shuffledState.pickAdventurer,
      activeSeatId: firstSeatId,
    },
  }
  match.value = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id,
    setup: setupSnapshot,
    state: initialPickState,
    history: [],
    presentationSpeedProfile: presentationSpeedProfile.value,
  }
  deferredPostDungeonState.value = null
  historyDrawerOpen.value = false
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  syncPresentationLabel()
}

function backToSetup() {
  match.value = null
  deferredPostDungeonState.value = null
  historyDrawerOpen.value = false
  clearCurrentMatch(window.localStorage)
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationSpeedProfile.value = 'cinematic'
  presentationOrchestrator.clear()
  syncPresentationLabel()
}

function takeHumanAction(action) {
  if (!match.value || !humanSeatId.value) {
    return
  }
  if (gameplayInputLocked.value) {
    return
  }
  if (autoResolveTimerId) {
    window.clearTimeout(autoResolveTimerId)
    autoResolveTimerId = null
  }
  if (equipmentModalOpen.value) equipmentModalOpen.value = false
  const prevState = match.value.state
  previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
  const result = applyAction(prevState, action, { seatId: humanSeatId.value })
  if (!result.ok) {
    return
  }
  const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
  if (deferExit) {
    deferredPostDungeonState.value = result.state
    match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
  } else {
    deferredPostDungeonState.value = null
    match.value = { ...match.value, state: result.state }
  }
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
  if (!token?.hasModal || gameplayInputLocked.value || !isHumanTurn.value || dungeonOutcomeDialogOpen.value) return
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

function continueFromDungeonOutcome() {
  const run = match.value?.state?.lastDungeonRun
  if (!run) return
  dismissedDungeonRun.value = run
  if (deferredPostDungeonState.value) {
    match.value = { ...match.value, state: deferredPostDungeonState.value }
    deferredPostDungeonState.value = null
  }
  presentationOrchestrator.flushPostDungeonOutcomeAnimations()
  syncPresentationLabel()
}

function confirmVorpalDeclaration() {
  if (!selectedVorpalSpecies.value) return
  takeHumanAction({
    type: 'DECLARE_VORPAL',
    species: selectedVorpalSpecies.value,
  })
}

async function runAiTurn() {
  if (aiTurnInFlight) return
  if (
    !match.value ||
    (match.value.state.phase !== 'bidding' &&
      match.value.state.phase !== 'dungeon' &&
      match.value.state.phase !== 'pick-adventurer')
  ) {
    return
  }
  const seatId = match.value.state.turn.activeSeatId
  if (!seatId || seatId === humanSeatId.value) return
  const runToken = `${match.value.id}:${match.value.state.turn.turnNumber}:${match.value.state.phase}:${seatId}`
  aiTurnInFlight = true
  try {
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
  if (!match.value) return
  const currentToken = `${match.value.id}:${match.value.state.turn.turnNumber}:${match.value.state.phase}:${match.value.state.turn.activeSeatId}`
  if (runToken !== currentToken) return
  const prevState = match.value.state
  if (humanSeatId.value) {
    previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
  }
  const result = applyAction(prevState, action, { seatId })
  if (!result.ok) return
  const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
  if (deferExit) {
    deferredPostDungeonState.value = result.state
    match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
  } else {
    deferredPostDungeonState.value = null
    match.value = { ...match.value, state: result.state }
  }
  enqueuePresentationTransition(prevState, result.state, action, seatId, roleType ?? 'randombot')
  } finally {
    aiTurnInFlight = false
  }
}

function shouldDeferDungeonExitUntilOutcomeAck(prevState, nextState) {
  return (
    prevState.phase === MATCH_PHASES.DUNGEON &&
    nextState.phase === MATCH_PHASES.PICK_ADVENTURER &&
    nextState.lastDungeonRun != null
  )
}

function enqueuePresentationTransition(prevState, nextState, action, actorSeatId, actorRoleType) {
  const deferPostDungeonOutcomeAck = shouldDeferDungeonExitUntilOutcomeAck(prevState, nextState)
  presentationOrchestrator.enqueueEngineTransition(
    {
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
      dungeonBefore: summarizeDungeonForPresentation(prevState.dungeon),
      dungeonAfter: summarizeDungeonForPresentation(nextState.dungeon),
    },
    { deferPostDungeonOutcomeAck },
  )
  if (presentationTraceEnabled()) {
    const snap = presentationOrchestrator.getQueueSnapshot()
    console.log('[DungeonRunner][presentation] enqueue', {
      phase: `${prevState.phase}→${nextState.phase}`,
      action: action?.type ?? null,
      actorRole: actorRoleType,
      queue: snap.map((x) => x.kind),
    })
  }
  syncPresentationLabel()
}

function summarizeDungeonForPresentation(dungeonState) {
  if (!dungeonState) return null
  const discardedRunMonsterIds = Array.isArray(dungeonState.discardedRunMonsters)
    ? [...dungeonState.discardedRunMonsters]
    : []
  return {
    subphase: dungeonState.subphase ?? null,
    currentMonster: dungeonState.currentMonster ?? null,
    remainingMonsterCount: Array.isArray(dungeonState.remainingMonsters)
      ? dungeonState.remainingMonsters.length
      : 0,
    discardedMonsterCount: discardedRunMonsterIds.length,
    discardedRunMonsterIds,
    hp: Number.isFinite(dungeonState.hp) ? dungeonState.hp : null,
  }
}

function syncPresentationLabel() {
  activePresentation.value = presentationOrchestrator.getActiveAnimation()
  activePresentationLabel.value = activePresentation.value?.label ?? ''
  gameplayInputLocked.value = presentationOrchestrator.isGameplayInputLocked()
  if (presentationTraceEnabled()) {
    const a = activePresentation.value
    const key = a ? `${a.id}:${a.kind}` : 'idle'
    if (key !== lastPresentationTraceKey) {
      lastPresentationTraceKey = key
      const snap = presentationOrchestrator.getQueueSnapshot()
      console.log('[DungeonRunner][presentation] active', a?.kind ?? 'idle', {
        ms: a?.remainingMs ?? null,
        queued: snap.map((x) => x.kind),
        inputLocked: gameplayInputLocked.value,
      })
    }
  }
}

function scheduleAiTurnIfReady() {
  if (aiTurnInFlight) return
  if (deferredPostDungeonState.value) return
  if (!match.value || gameplayInputLocked.value || isHumanTurn.value) return
  if (
    match.value.state.phase !== 'bidding' &&
    match.value.state.phase !== 'dungeon' &&
    match.value.state.phase !== 'pick-adventurer'
  ) {
    return
  }
  if (aiTurnTimerId) return
  aiTurnTimerId = window.setTimeout(() => {
    aiTurnTimerId = null
    void runAiTurn()
  }, 900)
}

function scheduleHumanAutoResolveIfReady() {
  if (!match.value) {
    return
  }
  if (gameplayInputLocked.value) {
    return
  }
  if (!isHumanTurn.value) {
    return
  }
  if (match.value.state.phase !== 'dungeon') {
    return
  }
  if (equipmentModalOpen.value || autoResolveTimerId) {
    return
  }
  const action = dungeonResolutionView.value.autoAdvanceAction
  const gate = {
    phase: match.value.state.phase,
    gameplayInputLocked: gameplayInputLocked.value,
    isHumanTurn: isHumanTurn.value,
    legalActions: legalActions.value,
    autoAdvanceAction: action,
    resolutionStatus: dungeonResolutionView.value.resolutionStatus,
    activeAnimationKind: activePresentation.value?.kind ?? null,
  }
  if (!shouldAutoResolveDungeonAdvance(gate)) {
    return
  }
  autoResolveTimerId = window.setTimeout(() => {
    autoResolveTimerId = null
    const execGate = {
      phase: match.value?.state?.phase ?? null,
      gameplayInputLocked: gameplayInputLocked.value,
      isHumanTurn: isHumanTurn.value,
      equipmentModalOpen: equipmentModalOpen.value,
      autoAdvanceAction: action,
      legalActions: legalActions.value,
      resolutionStatus: dungeonResolutionView.value.resolutionStatus,
      activeAnimationKind: activePresentation.value?.kind ?? null,
    }
    const ok = shouldExecuteScheduledAutoResolve(execGate)
    if (!ok) return
    takeHumanAction(action)
  }, 480)
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
    },
  }
}

function actionLabel(action) {
  return legalActionBoardLabel(action)
}

function actionKey(action) {
  const id = [action.equipmentId, action.hero, action.species].filter((x) => x != null && x !== '').join('-')
  return id ? `${action.type}-${id}` : action.type
}

function isDungeonPresentationKind(kind) {
  return (
    kind === 'DUNGEON_REVEAL' ||
    kind === 'DUNGEON_NEUTRALIZE' ||
    kind === 'DUNGEON_DAMAGE' ||
    kind === 'DUNGEON_CONTINUE' ||
    kind === 'DUNGEON_OUTCOME'
  )
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
  const pace =
    loaded.match.presentationSpeedProfile === 'brisk' || loaded.match.presentationSpeedProfile === 'cinematic'
      ? loaded.match.presentationSpeedProfile
      : 'cinematic'
  match.value = { ...loaded.match, presentationSpeedProfile: pace }
  deferredPostDungeonState.value = null
  presentationOrchestrator.clear()
  presentationSpeedProfile.value = pace
  presentationOrchestrator.setSpeedProfile(pace)
  syncPresentationLabel()
  resumeDialogOpen.value = false
}

function startFreshFromDialog() {
  clearCurrentMatch(window.localStorage)
  deferredPostDungeonState.value = null
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
    presentationSpeedProfile: match.value.presentationSpeedProfile,
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
    const pace =
      imported.replay.presentationSpeedProfile === 'brisk' ||
      imported.replay.presentationSpeedProfile === 'cinematic'
        ? imported.replay.presentationSpeedProfile
        : 'cinematic'
    match.value = {
      schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
      id: `match-${Date.now()}`,
      setup: imported.replay.setup,
      state: replayResult.state,
      history: [],
      presentationSpeedProfile: pace,
    }
    deferredPostDungeonState.value = null
    presentationSpeedProfile.value = pace
    presentationOrchestrator.setSpeedProfile(pace)
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

.dr-board-shell {
  position: relative;
}

.dr-presentation-flight-layer {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  overflow: visible;
}

.dr-header {
  flex-shrink: 0;
  position: relative;
  z-index: 30;
}

.dr-bidding-board {
  position: relative;
  z-index: 0;
  isolation: isolate;
  border-radius: 10px;
  overflow: hidden;
}

.dr-pile-badge {
  background-image: linear-gradient(180deg, rgba(42, 42, 42, 0.92), rgba(58, 58, 58, 0.9)), var(--dr-pile);
  background-size: auto, 150% auto;
  background-position: center, 50% 45%;
  background-repeat: no-repeat;
}

.dr-equip-badge .dr-equip-icon {
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 0 0.5px rgba(0, 0, 0, 0.35));
}

.dr-equip-badge--spent {
  opacity: 0.55;
}

.dr-equip-badge--interactive {
  cursor: pointer;
}

.dr-board-primary {
  width: 100%;
  isolation: isolate;
}

.dr-hero-card-slot {
  width: 100%;
  position: relative;
}

.dr-hero-card-control {
  width: 100%;
  display: block;
}

.dr-dungeon-card-motion-wrap {
  width: 100%;
  display: block;
}

.dr-hero-card-control :deep(.dr-monster-card) {
  width: 100%;
  max-width: none;
  margin: 0;
}

.dr-seat-strip {
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
}

.dr-seat-strip > * {
  flex-shrink: 0;
}

@keyframes dr-token-pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.03);
  }
}

.dr-card-preview {
  width: 100%;
  max-width: 140px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
}

.dr-token-glow {
  box-shadow:
    0 0 0 2px rgba(255, 193, 7, 0.95),
    0 0 0 4px rgba(255, 152, 0, 0.45),
    0 0 22px rgba(255, 193, 7, 0.75),
    0 0 40px rgba(255, 160, 0, 0.35);
}

.dr-token-pulse {
  animation: dr-token-pulse 0.85s ease-in-out infinite alternate;
}

.dr-equip-badge--deemphasized {
  opacity: 0.5;
  filter: saturate(0.7);
}

.dr-dungeon-stage .dr-hero-card-control {
  transform-origin: center;
}

.dr-dungeon-stage__hp-chip {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 2;
}

.dr-token-icon {
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
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
  box-shadow: inset 0 0 0 2px rgba(46, 125, 50, 0.5);
}

.dr-turn-hero-row {
  gap: 6px;
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
  gap: 12px;
  z-index: 20;
  cursor: pointer;
}

.dr-hero-interstitial__transition {
  gap: 1rem;
}

.dr-hero-interstitial__arrow {
  font-size: 1.75rem;
  opacity: 0.85;
  animation: dr-hero-arrow-pulse 1.1s ease-in-out infinite alternate;
}

.dr-hero-interstitial__avatar--from {
  opacity: 0.88;
  transform: scale(0.92);
}

.dr-hero-interstitial__avatar--to {
  animation: dr-hero-interstitial-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes dr-hero-interstitial-pop {
  from {
    transform: scale(0.72);
    opacity: 0.35;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes dr-hero-arrow-pulse {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}

.dr-hero-interstitial__hint {
  font-size: 0.85rem;
  opacity: 0.75;
}
</style>

<style>
/* Quasar portals dialogs outside scoped tree; keep equipment modal above board texture & memory-aid layers */
.dr-equipment-dialog .q-dialog__inner {
  z-index: 9000 !important;
}
</style>
