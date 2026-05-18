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
          :disable="dungeonOutcomeDialogOpen"
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
        :disable="match && dungeonOutcomeDialogOpen"
        @click="helpOpen = true"
      />
      <q-btn
        flat
        dense
        icon="settings"
        aria-label="Dungeon Runner settings"
        :disable="Boolean(match) && dungeonOutcomeDialogOpen"
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
              :model-value="memoryAidState.enabled"
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
      <q-card v-if="!match" flat bordered class="q-pa-md">
        <div class="text-subtitle1 q-mb-sm">Setup</div>
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-sm-6">
            <div class="text-body2 q-mb-sm">Total players</div>
            <q-slider
              v-model="setup.totalSeats"
              :min="totalSeatSlider.min"
              :max="totalSeatSlider.max"
              :step="totalSeatSlider.step"
              snap
              markers
              marker-labels
              color="primary"
              aria-label="Total players"
              class="dr-total-seats-slider q-px-sm"
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
          <div
            v-if="showDungeonStage && dungeonStageView.hpBar"
            class="dr-dungeon-hp-bar q-mb-sm"
            role="meter"
            aria-label="Adventurer HP"
            aria-valuemin="0"
            :aria-valuemax="dungeonStageView.hpBar.displayMaxHp"
            :aria-valuenow="dungeonStageView.hpBar.currentHp"
          >
            <div class="row items-center justify-between q-mb-xs">
              <span class="text-caption text-weight-medium">HP</span>
              <span class="text-caption">{{ dungeonStageView.hpBar.text }}</span>
            </div>
            <div class="dr-dungeon-hp-bar__track">
              <div
                class="dr-dungeon-hp-bar__fill"
                :style="{ width: `${dungeonStageView.hpBar.percent}%` }"
              />
            </div>
          </div>
          <q-card
            flat
            bordered
            class="q-pa-sm q-mb-sm dr-bidding-board"
            :class="biddingBoard.heroCue.accentClass"
          >
          <div
            v-if="seatRunTrackerRows.length"
            class="dr-seat-strip q-mb-sm"
          >
            <div class="row q-col-gutter-xs">
              <div v-for="row in seatRunTrackerRows" :key="`seat-${row.seatId}`" class="col dr-seat-stack">
                <q-badge
                  :color="row.passed ? 'grey-9' : biddingBoard.heroCue.badgeColor"
                  text-color="white"
                  class="dr-seat-chip q-px-sm full-width"
                  :class="{ 'dr-token-glow': row.isActive }"
                >
                  <span class="text-caption">{{ row.label }}</span>
                </q-badge>
                <div class="dr-seat-progress-cell text-caption" :aria-label="row.ariaLabel">
                  <span
                    v-for="index in row.successes"
                    :key="`success-${row.seatId}-${index}`"
                    class="dr-seat-progress-marker dr-seat-progress-marker--success"
                  >
                    ✓
                  </span>
                  <span
                    v-for="index in row.failures"
                    :key="`failure-${row.seatId}-${index}`"
                    class="dr-seat-progress-marker dr-seat-progress-marker--failure"
                  >
                    X
                  </span>
                </div>
              </div>
            </div>
          </div>
          <q-card-section class="q-pa-none q-mb-sm dr-board-primary">
            <div
              ref="heroCardSlotRef"
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
                  :empty="monsterCardSlotEmpty"
                  :hide-empty-slot="showDungeonStage"
                  :species="showDungeonStage ? dungeonStageView.monster.frontFaceSpecies : biddingStageSpecies"
                  :face-down="
                    showDungeonStage
                      ? dungeonStageView.monster.visibility === 'face-down'
                      : biddingStageFaceDown
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
              <div ref="dungeonPileMotionAnchorRef" class="full-width">
                <q-badge
                  text-color="white"
                  class="full-width q-py-xs justify-between dr-pile-badge dr-pile-badge--dungeon"
                  :style="{ '--dr-pile': `url('${uiAssets.piles.dungeon.runtimePath}')` }"
                >
                  <span>Dungeon</span>
                  <span>{{ biddingBoard.secondary.dungeonCount }}</span>
                </q-badge>
              </div>
            </div>
            <div class="col-4">
              <div class="row no-wrap items-center full-width dr-turn-hero-row">
                <q-chip
                  :color="biddingBoard.heroCue.badgeColor"
                  text-color="white"
                  dense
                  :aria-label="biddingBoard.heroCue.shortLabel"
                >
                  {{ biddingBoard.heroCue.shortLabel }}
                </q-chip>
              </div>
            </div>
          </div>
          <div class="row q-mt-none">
            <div
              v-for="token in boardEquipmentTokens"
              :key="token.equipmentId"
              class="col-4 flex flex-center"
            >
              <div
                :ref="(el) => bindBiddingEquipmentBadgeRef(token.equipmentId, el)"
                class="dr-equip-token"
                :class="{
                  'dr-equip-token--spent': token.removed,
                  'dr-token-glow': token.glow,
                  'dr-token-pulse': token.pulse,
                  'dr-equip-token--deemphasized': token.deemphasized,
                  'dr-equip-token--interactive': token.hasModal,
                }"
                :tabindex="token.hasModal ? 0 : -1"
                :role="token.hasModal ? 'button' : 'img'"
                :aria-disabled="token.hasModal ? undefined : 'true'"
                :aria-label="token.ariaLabel"
                @click="openEquipmentModal(token)"
                @keydown.enter.prevent="openEquipmentModal(token)"
                @keydown.space.prevent="openEquipmentModal(token)"
              >
                <img
                  class="dr-equip-token__plate"
                  :src="uiAssets.equipment.plate.runtimePath"
                  alt=""
                  draggable="false"
                />
                <img
                  class="dr-equip-token__symbol"
                  :src="token.symbolRuntimePath"
                  alt=""
                  draggable="false"
                />
                <span v-if="token.equipmentOverlay != null" class="dr-equip-token__overlay" aria-hidden="true">
                  +{{ token.equipmentOverlay }}
                </span>
              </div>
            </div>
          </div>
        </q-card>

        <q-card v-if="showActionPane" flat bordered class="q-pa-sm q-mb-md">
          <div v-if="activePresentationLabel" class="text-body2 text-grey-6 q-mb-xs">{{ activePresentationLabel }}</div>
          <div v-if="isHumanTurn" class="row q-col-gutter-sm q-gutter-y-sm">
            <template v-if="match.state.phase === 'bidding' && biddingSacrificeActions.length > 1">
              <q-btn
                v-for="action in biddingNonSacrificeActions"
                :key="actionKey(action)"
                :color="biddingBoard.heroCue.buttonColor"
                unelevated
                no-caps
                size="lg"
                class="col-12 col-sm-auto"
                :label="actionLabel(action)"
                :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
                @click="takeHumanAction(action)"
              />
              <q-btn-dropdown
                :color="biddingBoard.heroCue.buttonColor"
                unelevated
                no-caps
                dense
                size="lg"
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
              <template v-if="showHeroPickActionGrid">
                <div class="col-12 text-h5 text-weight-medium text-grey-5 q-mb-xs" style="text-align: center;">Select Adventurer</div>
                <div class="dr-hero-pick-grid col-12">
                  <q-btn
                    v-for="action in heroPickActionsOrdered"
                    :key="actionKey(action)"
                    :color="getHeroIdentity(action.hero).buttonColor"
                    unelevated
                    no-caps
                    dense
                    size="lg"
                    class="dr-hero-pick-grid__btn full-width"
                    :label="getHeroIdentity(action.hero).shortLabel"
                    :aria-label="actionLabel(action)"
                    :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
                    @click="takeHumanAction(action)"
                  />
                </div>
              </template>
              <template v-else>
                <q-btn
                  v-for="action in visiblePrimaryActions"
                  :key="actionKey(action)"
                  :color="biddingBoard.heroCue.buttonColor"
                  unelevated
                  no-caps
                  dense
                  size="lg"
                  class="col-12 col-sm-auto"
                  :label="actionLabel(action)"
                  :disable="gameplayInputLocked || dungeonOutcomeDialogOpen"
                  @click="takeHumanAction(action)"
                />
              </template>
            </template>
          </div>
          <div v-if="isHumanTurn && dungeonOutcomeTransitionControls.length" class="row q-col-gutter-sm q-gutter-y-sm q-mt-xs">
            <q-btn
              v-for="control in dungeonOutcomeTransitionControls"
              :key="control.key"
              :color="biddingBoard.heroCue.buttonColor"
              unelevated
              no-caps
              dense
              size="md"
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
      <p class="dr-hero-interstitial__headline">{{ heroChangeInterstitialView.headline }}</p>
      <q-avatar
        :color="heroChangeInterstitialView.chosen.badgeColor"
        text-color="white"
        size="56px"
        font-size="1.25rem"
        class="dr-hero-interstitial__avatar"
      >
        {{ heroChangeInterstitialView.chosen.badgeGlyph }}
      </q-avatar>
    </button>

    <q-dialog v-model="dungeonOutcomeDialogOpen" persistent transition-show="scale" transition-hide="scale">
      <q-card class="q-pa-md dr-dungeon-outcome-dialog" :class="dungeonOutcomeToneClass" style="min-width: 340px">
        <div class="text-overline dr-outcome-kicker">Dungeon run resolved</div>
        <div class="text-h5 text-weight-bold q-mb-sm dr-outcome-title">
          {{ dungeonOutcomeSummary?.resultLabel }}
        </div>
        <div class="text-body1 q-mb-xs">
          Runner: <span class="text-weight-bold">{{ dungeonOutcomeSummary?.runnerLabel }}</span>
        </div>
        <div class="text-body2 q-mb-md dr-outcome-message">{{ dungeonOutcomeMessage }}</div>
        <div class="row justify-end">
          <q-btn color="primary" unelevated label="Continue" class="dr-outcome-btn" @click="continueFromDungeonOutcome" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="matchOverDialogOpen" persistent transition-show="scale" transition-hide="scale">
      <q-card class="q-pa-md dr-match-over-dialog" :class="matchOverToneClass" style="min-width: 340px">
        <div class="text-overline dr-outcome-kicker">Match complete</div>
        <div class="text-h5 text-weight-bold q-mb-sm dr-outcome-title">{{ matchOverSummary.title }}</div>
        <div class="text-body1 q-mb-xs">{{ matchOverSummary.message }}</div>
        <div class="text-body2 q-mb-md">Winner: {{ matchOverSummary.winnerLabel }}</div>
        <div class="row q-gutter-sm justify-end">
          <q-btn color="primary" unelevated label="Rematch" class="dr-outcome-btn" @click="rematch" />
          <q-btn flat color="primary" label="Back to setup" class="dr-outcome-btn-secondary" @click="backToSetup" />
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

    <q-dialog v-model="confirmationDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">{{ confirmationDialogTitle }}</div>
        <div class="text-body2 q-mb-md">{{ confirmationDialogMessage }}</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn flat color="primary" :label="confirmationDialogCancelLabel" @click="onConfirmationDialogCancel" />
          <q-btn color="primary" unelevated :label="confirmationDialogOkLabel" @click="onConfirmationDialogOk" />
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

    <DungeonRunnerHelpDialog v-model="helpOpen" />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, triggerRef, unref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useScopedFullscreen } from '../../features/game-timer/composables/useScopedFullscreen.js'
import { useDungeonRunnerSettingsStore } from '../../stores/dungeonRunnerSettings.js'
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
import { chooseNnActionWithFallback, warmNnModelCache } from '../../features/dungeon-runner/nn/runtime.js'
import { createModelFailureRecovery } from '../../features/dungeon-runner/nn/recovery.js'
import { fetchModelCatalog } from '../../features/dungeon-runner/models/catalog.js'
import { pickDefaultModelId, validateSelectedModels } from '../../features/dungeon-runner/models/discovery.js'
import {
  createPresentationOrchestrator,
  SPEED_PROFILES,
} from '../../features/dungeon-runner/ui/presentationOrchestrator.js'
import {
  DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS,
  runPresentationIntervalTick,
} from '../../features/dungeon-runner/ui/dungeonRunnerPresentationInterval.js'
import { buildAiTurnRunToken } from '../../features/dungeon-runner/ui/dungeonRunnerAiTurnToken.js'
import {
  consumeAiTurnPrefetch,
  resetAiTurnPrefetch,
  startAiTurnPrefetch,
} from '../../features/dungeon-runner/ui/dungeonRunnerAiTurnPrefetch.js'
import { createPipelineStepLogger } from '../../features/dungeon-runner/nn/nnPipelineTrace.js'
import {
  dungeonRunnerAssetPack,
  dungeonRunnerEquipmentSymbolRuntimePath,
} from '../../features/dungeon-runner/ui/assetPack.js'
import { equipmentTokenAppearance } from '../../features/dungeon-runner/equipmentTokenAppearance.js'
import { equipmentShortName } from '../../features/dungeon-runner/data/gameDataCatalog.js'
import {
  adventurerChoiceHeadline,
  legalActionBoardLabel,
} from '../../features/dungeon-runner/ui/dungeonRunnerPlayerPhrasing.js'
import {
  buildDungeonEquipmentTokenView,
  createDungeonEquipmentModalView,
  createVorpalDeclarationPromptView,
  filterVisibleLegalActions,
} from '../../features/dungeon-runner/ui/dungeonEquipmentInteractions.js'
import { createBiddingBoardViewModel } from '../../features/dungeon-runner/ui/biddingBoardViewModel.js'
import {
  viewerMaySeeAddToDungeonFlipDown,
  viewerMaySeeBiddingDrawFace,
} from '../../features/dungeon-runner/ui/biddingPresentationVisibility.js'
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
import DungeonRunnerHelpDialog from '../../features/dungeon-runner/ui/DungeonRunnerHelpDialog.vue'
import { closeDeckSplay, createMemoryAidState, setMemoryAidEnabled, tapDeck } from '../../features/dungeon-runner/ui/memoryAidState.js'
import { isDungeonPresentationTraceEnabled } from '../../features/dungeon-runner/ui/dungeonPresentationTrace.js'
import { isDungeonOrchestratorPresentationKind } from '../../features/dungeon-runner/ui/orchestratorPresentationKinds.js'
import { usePresentationMotion } from '../../features/dungeon-runner/ui/usePresentationMotion.js'
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
const activePresentation = ref(null)
const boardShellRef = ref(null)
const heroCardSlotRef = ref(null)
const dungeonCardMotionWrap = ref(null)
const dungeonCardFaceRef = ref(null)
const deckBadgeRef = ref(null)
const dungeonPileMotionAnchorRef = ref(null)
const heroChangeInterstitialOverlayRef = ref(null)
const presentationFlightLayerRef = ref(null)
const biddingEquipmentBadgeRefs = reactive({})

function domEl(componentOrEl) {
  if (!componentOrEl) return null
  if (componentOrEl.nodeType === 1) return componentOrEl
  const inner = componentOrEl.$el
  return inner?.nodeType === 1 ? inner : null
}

/** `defineExpose`d Refs from child components; QBadge roots via {@link domEl}. */
function unwrapMotionDom(exposedMaybeRef) {
  if (exposedMaybeRef == null) return null
  const el = unref(exposedMaybeRef)
  return el?.nodeType === 1 ? el : null
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
      dungeonCardFlipAxis: unwrapMotionDom(dungeonCardFaceRef.value?.dungeonCardFlipAxis),
      deckBadge: domEl(deckBadgeRef.value),
      dungeonPileBadge: dungeonPileMotionAnchorRef.value,
      presentationFlightLayer: presentationFlightLayerRef.value,
      presentationGhostTarget: heroCardSlotRef.value,
    }
    if (
      presentationTraceEnabled() &&
      (head?.kind === 'DUNGEON_REVEAL' || head?.kind === 'BIDDING_DRAW')
    ) {
      const snapEl = (el) => {
        if (!el || typeof el.getBoundingClientRect !== 'function') return { present: false }
        const r = el.getBoundingClientRect()
        return {
          present: true,
          tag: el.tagName,
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          cx: Math.round((r.left + r.width / 2) * 100) / 100,
          cy: Math.round((r.top + r.height / 2) * 100) / 100,
        }
      }
      const deckNode = domEl(deckBadgeRef.value)
      console.log('[DungeonRunner][card-flight][refs]', {
        kind: head.kind,
        id: head.id,
        durationMs: head.durationMs,
        dungeonCardWrap: snapEl(base.dungeonCardWrap),
        dungeonPileAnchor: snapEl(base.dungeonPileBadge),
        deckBadgeResolved: snapEl(base.deckBadge),
        dungeonCardFlipAxis: snapEl(base.dungeonCardFlipAxis),
        deckBadgeRawDomEl: snapEl(deckNode),
        refsBound: {
          dungeonPileMotionAnchorRef: !!dungeonPileMotionAnchorRef.value,
          deckBadgeRef: !!deckBadgeRef.value,
          dungeonCardMotionWrap: !!dungeonCardMotionWrap.value,
          dungeonCardFaceRef: !!dungeonCardFaceRef.value,
        },
      })
    }
    if (head?.kind !== 'BIDDING_SACRIFICE' && head?.kind !== 'DUNGEON_NEUTRALIZE') return base
    const ids = head?.payload?.responsibleEquipmentIds ?? head?.payload?.consumedEquipmentIds ?? []
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
const confirmationDialogOpen = ref(false)
const confirmationDialogTitle = ref('Confirm')
const confirmationDialogMessage = ref('')
const confirmationDialogOkLabel = ref('OK')
const confirmationDialogCancelLabel = ref('Cancel')
let confirmationDialogResolve = null
const vorpalDialogOpen = ref(false)
const selectedVorpalSpecies = ref(null)
const memoryAidState = ref(createMemoryAidState({ enabled: dungeonRunnerSettingsStore.memoryAidEnabled }))
const previousVisibleState = ref(null)
const dismissedDungeonRun = ref(null)
const equipmentRemainingAtResolution = ref(null)
const deferredPostDungeonState = ref(null)
let presentationTimerId = null
let aiTurnTimerId = null
let autoResolveTimerId = null
let aiTurnInFlight = false
let lastAppliedAiTurnToken = null
let presentationInputWasLocked = false
let lastPresentationTraceKey = null
let lastScheduleSkipKey = ''
let lastPrimeSkipTraceKey = ''
/** @type {Promise<void> | null} */
let nnModelsWarmPromise = null

const AI_TURN_SCHEDULE_DELAY_MS = 300

function aiTurnTrace(baseContext = {}) {
  return createPipelineStepLogger('AITurn', debugMode.value, {
    matchId: match.value?.id ?? null,
    ...baseContext,
  })
}

const SCHEDULE_SKIP_THROTTLE_REASONS = new Set([
  'gameplay-locked',
  'timer-pending',
  'in-flight',
  'already-applied-token',
  'deferred-post-dungeon',
])

function logAiTurnScheduleSkip(reason, detail = {}) {
  if (!debugMode.value) return
  const key = `${reason}:${detail.runToken ?? detail.activeKind ?? ''}`
  if (SCHEDULE_SKIP_THROTTLE_REASONS.has(reason) && key === lastScheduleSkipKey) return
  lastScheduleSkipKey = key
  console.warn('[DungeonRunner][AITurn][Schedule] skip', reason, detail)
}

function logAiTurnPrimeSkip(reason, detail = {}) {
  if (!debugMode.value) return
  const key = `${reason}:${detail.runToken ?? detail.phase ?? detail.seatId ?? detail.roleType ?? ''}`
  if (key === lastPrimeSkipTraceKey) return
  lastPrimeSkipTraceKey = key
  aiTurnTrace()('prefetch.prime.skip', { reason, ...detail })
}

function scheduleAiTurnOnPresentationTick() {
  if (!match.value || isHumanTurn.value || deferredPostDungeonState.value) return
  scheduleAiTurnIfReady()
}
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
  () => dungeonRunnerSettingsStore.memoryAidEnabled,
  (enabled) => {
    memoryAidState.value = setMemoryAidEnabled(memoryAidState.value, enabled)
  },
  { immediate: true },
)

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
const visiblePrimaryActions = computed(() =>
  visibleLegalActions.value.filter((action) => action.type !== 'REVEAL_OR_CONTINUE'),
)
/** Matches engine pick-adventurer legal action order. */
const HERO_CHOICE_ACTION_ORDER = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']
const showHeroPickActionGrid = computed(() => {
  const actions = visiblePrimaryActions.value
  if (actions.length !== HERO_CHOICE_ACTION_ORDER.length) return false
  return actions.every((a) => a.type === 'CHOOSE_NEXT_ADVENTURER')
})
const heroPickActionsOrdered = computed(() => {
  if (!showHeroPickActionGrid.value) return []
  const byHero = new Map(visiblePrimaryActions.value.map((a) => [a.hero, a]))
  return HERO_CHOICE_ACTION_ORDER.map((hero) => byHero.get(hero)).filter(Boolean)
})
const showActionPane = computed(
  () =>
    !!activePresentationLabel.value ||
    (isHumanTurn.value &&
      (visiblePrimaryActions.value.length > 0 || dungeonOutcomeTransitionControls.value.length > 0)),
)
const biddingSacrificeActions = computed(() => visibleLegalActions.value.filter((a) => a.type === 'SACRIFICE'))
const biddingNonSacrificeActions = computed(() => visibleLegalActions.value.filter((a) => a.type !== 'SACRIFICE'))
const gameplayInputLocked = ref(false)
const visibleState = computed(() => {
  if (!match.value || !humanSeatId.value) return null
  return getPlayerView(match.value.state, { seatId: humanSeatId.value })
})
const dungeonOutcomeAckPending = computed(() =>
  isDungeonOutcomeDialogOpen({
    lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
    dismissedDungeonRun: dismissedDungeonRun.value,
  }),
)
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
  if (isDungeonOrchestratorPresentationKind(activePresentation.value?.kind ?? null)) return true
  return dungeonOutcomeAckPending.value
})
const dungeonStageView = computed(() =>
  createDungeonResolutionViewModel({
    visibleState: visibleState.value ?? {},
    previousVisibleState: previousVisibleState.value ?? {},
    legalActions: legalActions.value,
    activeAnimation: activePresentation.value,
    preserveMonsterCardUntilRunAck: dungeonOutcomeAckPending.value,
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
    const removed =
      equipment.removed ||
      equipment.consumed ||
      (isDungeonPhase && !dungeonTokenById.has(equipment.equipmentId))
    const actionable = isDungeonPhase && actionableEquipmentIds.value.has(equipment.equipmentId)
    const appearance = equipmentTokenAppearance(equipment.equipmentId)
    return {
      equipmentId: equipment.equipmentId,
      ariaLabel: equipmentShortName(equipment.equipmentId),
      symbolRuntimePath: dungeonRunnerEquipmentSymbolRuntimePath(appearance.symbolKey),
      equipmentOverlay: appearance.overlay,
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
const seatRunTrackerRows = computed(() => {
  const scoreboard = match.value?.state?.scoreboard ?? {}
  return biddingBoard.value.secondary.seats.map((row) => {
    const score = scoreboard[row.seatId] ?? {}
    const successes = Math.max(0, Number(score.successes ?? 0))
    const failures = Math.max(0, 2 - Number(score.lives ?? 2))
    return {
      seatId: row.seatId,
      label: row.label,
      passed: row.passed,
      isActive: row.isActive,
      successes,
      failures,
      ariaLabel: `${row.label}: ${successes} successful run${successes === 1 ? '' : 's'}, ${failures} failed run${failures === 1 ? '' : 's'}`,
    }
  })
})
const biddingCardEmpty = computed(
  () =>
    match.value?.state?.phase === 'bidding' &&
    !showDungeonStage.value &&
    biddingBoard.value.primaryCard.variant === 'empty',
)
const monsterCardSlotEmpty = computed(() => {
  if (showDungeonStage.value) return dungeonStageView.value.monster.visibility === 'empty'
  return biddingCardEmpty.value
})
const biddingStageSpecies = computed(() => {
  if (showDungeonStage.value) return null
  if (match.value?.state?.phase !== 'bidding') return null
  if (activePresentation.value?.kind === 'BIDDING_DRAW') return null
  return biddingBoard.value.primaryCard.variant === 'revealed' ? biddingBoard.value.primaryCard.monsterCard : null
})
const biddingStageFaceDown = computed(() => {
  if (showDungeonStage.value) return true
  if (match.value?.state?.phase !== 'bidding') return true
  if (activePresentation.value?.kind === 'BIDDING_DRAW') return true
  return biddingBoard.value.primaryCard.variant !== 'revealed'
})
const heroChangeInterstitialView = computed(() => {
  if (activePresentation.value?.kind !== 'HERO_CHANGE_INTERSTITIAL') return null
  const payload = activePresentation.value?.payload
  if (!payload?.heroAfter) return null
  const seats = match.value?.state?.seats ?? []
  const actorSeatId = payload.actorSeatId ?? null
  const actorLabel =
    seats.find((seat) => seat.id === actorSeatId)?.label ?? actorSeatId ?? 'Unknown'
  const chosen = getHeroIdentity(payload.heroAfter)
  return {
    headline: adventurerChoiceHeadline(actorLabel, payload.heroAfter),
    chosen,
  }
})
const heroChangeInterstitialAriaLabel = computed(() => heroChangeInterstitialView.value?.headline ?? '')
const deckSplayOpen = computed({
  get() {
    return memoryAidState.value.deckSplayOpen
  },
  set(open) {
    memoryAidState.value = open ? tapDeck(memoryAidState.value) : closeDeckSplay(memoryAidState.value)
  },
})
const dungeonOutcomeSummary = computed(() =>
  buildDungeonOutcomeSummary({
    lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
    seats: match.value?.state?.seats ?? [],
    equipmentRemainingAtResolution: equipmentRemainingAtResolution.value,
  }),
)
const dungeonOutcomeToneClass = computed(() =>
  dungeonOutcomeSummary.value?.resultLabel === 'Success' ? 'dr-outcome--success' : 'dr-outcome--failure',
)
const dungeonOutcomeMessage = computed(() =>
  dungeonOutcomeSummary.value?.resultLabel === 'Success'
    ? 'Clean run. The dungeon is cleared.'
    : 'The run failed.',
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
const matchOverSummary = computed(() => {
  const fallback = {
    title: 'Match over',
    message: 'The match has ended.',
    winnerLabel: 'Unknown',
  }
  if (!match.value || match.value.state.phase !== MATCH_PHASES.MATCH_OVER) return fallback
  const winnerSeatId = match.value.state.matchWinnerSeatId
  const winnerSeat = match.value.state.seats.find((seat) => seat.id === winnerSeatId)
  const winnerLabel = winnerSeat?.label ?? winnerSeatId ?? 'Unknown'
  const isHumanWinner = winnerSeatId != null && winnerSeatId === humanSeatId.value
  if (isHumanWinner) {
    return {
      title: 'Victory!',
      message: 'You won the match. Great run.',
      winnerLabel,
    }
  }
  return {
    title: 'Defeat',
    message: `${winnerLabel} won this match.`,
    winnerLabel,
  }
})
const matchOverToneClass = computed(() => (matchOverSummary.value.title === 'Victory!' ? 'dr-outcome--success' : 'dr-outcome--failure'))
const matchOverDialogOpen = computed({
  get() {
    return !!match.value && match.value.state.phase === MATCH_PHASES.MATCH_OVER
  },
  set() {
    // Persistent modal; rematch/back-to-setup are the only exits.
  },
})

onMounted(() => {
  debugMode.value = shouldEnableDebugOnBoot(window.location.href)
  presentationOrchestrator.setSpeedProfile(presentationSpeedProfile.value)
  if (presentationTraceEnabled()) {
    console.log(
      '[DungeonRunner][presentation] trace on — localStorage.setItem("dungeonPresentationTrace","1") — also logs [card-flight] for pile/deck → card motion',
    )
  }
  const loaded = loadCurrentMatch(window.localStorage)
  if (loaded.ok) {
    const pace =
      loaded.match.presentationSpeedProfile === 'brisk' || loaded.match.presentationSpeedProfile === 'cinematic'
        ? loaded.match.presentationSpeedProfile
        : 'cinematic'
    dungeonRunnerSettingsStore.setAnimationPace(pace)
    match.value = { ...loaded.match, presentationSpeedProfile: pace }
    deferredPostDungeonState.value = null
    presentationOrchestrator.clear()
    presentationSpeedProfile.value = pace
    presentationOrchestrator.setSpeedProfile(pace)
    syncPresentationLabel()
  }
  void loadModelCatalog()
  presentationTimerId = window.setInterval(() => {
    runPresentationIntervalTick(presentationOrchestrator, DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS, {
      syncPresentationLabel,
      scheduleAiTurnIfReady: scheduleAiTurnOnPresentationTick,
      scheduleHumanAutoResolveIfReady,
    })
  }, DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS)
})

onBeforeUnmount(() => {
  if (presentationTimerId) window.clearInterval(presentationTimerId)
  if (aiTurnTimerId) window.clearTimeout(aiTurnTimerId)
  if (autoResolveTimerId) window.clearTimeout(autoResolveTimerId)
  if (typeof confirmationDialogResolve === 'function') {
    confirmationDialogResolve(false)
    confirmationDialogResolve = null
  }
})

watch(
  () => match.value?.state?.phase,
  (phase) => {
    if (phase === MATCH_PHASES.MATCH_OVER) completedMatchReplayUpload.maybeUpload(match.value)
  },
  { immediate: true },
)

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
    presentationSpeedProfile: presentationSpeedProfile.value,
  }
  deferredPostDungeonState.value = null
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  lastAppliedAiTurnToken = null
  resetAiTurnPrefetch()
  presentationInputWasLocked = false
  nnModelsWarmPromise = preloadNnModelsForSetup(setupSnapshot)
  syncPresentationLabel()
}

function rematch() {
  if (!match.value) return
  const seed = createMatchSeed()
  const id = `match-${Date.now()}`
  const setupSnapshot = cloneSetup(match.value.setup)
  const baseState = createInitialMatchState(setupSnapshot, { seed })
  const preservedBotLabels = match.value.state.seats
    .filter((seat) => seat.role?.type !== 'human' && seat.label)
    .map((seat) => seat.label)
  const shuffledState = shuffleMatchDeck(
    shuffleMatchSeats(baseState, {
      seed: seed ^ 0x5f3759df,
      preservedBotLabels,
    }),
    {
      seed: seed ^ 0x9e3779b9,
    },
  )
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
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  lastAppliedAiTurnToken = null
  resetAiTurnPrefetch()
  presentationInputWasLocked = false
  nnModelsWarmPromise = preloadNnModelsForSetup(setupSnapshot)
  syncPresentationLabel()
}

function preloadNnModelsForSetup(setupSnapshot) {
  const modelIds = [
    ...new Set(
      (setupSnapshot?.opponents ?? [])
        .filter((opponent) => opponent.type === 'nn')
        .map((opponent) => opponent.modelId ?? 'latest'),
    ),
  ]
  if (!modelIds.length) return Promise.resolve()
  return warmNnModelCache(modelIds)
}

async function ensureNnModelsReady() {
  await nnModelsWarmPromise?.catch(() => {})
}

function backToSetup() {
  match.value = null
  lastAppliedAiTurnToken = null
  resetAiTurnPrefetch()
  nnModelsWarmPromise = null
  presentationInputWasLocked = false
  deferredPostDungeonState.value = null
  clearCurrentMatch(window.localStorage)
  nnDebugTraceText.value = ''
  nnDebugTraceHistory.value = []
  presentationOrchestrator.clear()
  syncPresentationLabel()
}

function takeHumanAction(action) {
  if (!match.value || !humanSeatId.value) {
    return
  }
  resetAiTurnPrefetch()
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
  dungeonRunnerSettingsStore.setMemoryAidEnabled(enabled === true)
}

function onDeckTap() {
  memoryAidState.value = tapDeck(memoryAidState.value)
}

function onCloseDeckSplay() {
  memoryAidState.value = closeDeckSplay(memoryAidState.value)
}

function settleConfirmationDialog(result) {
  confirmationDialogOpen.value = false
  const resolve = confirmationDialogResolve
  confirmationDialogResolve = null
  if (typeof resolve === 'function') resolve(result)
}

function requestConfirmation({ title = 'Confirm', message, okLabel = 'OK', cancelLabel = 'Cancel' }) {
  if (typeof confirmationDialogResolve === 'function') {
    confirmationDialogResolve(false)
    confirmationDialogResolve = null
  }
  confirmationDialogTitle.value = title
  confirmationDialogMessage.value = message
  confirmationDialogOkLabel.value = okLabel
  confirmationDialogCancelLabel.value = cancelLabel
  confirmationDialogOpen.value = true
  return new Promise((resolve) => {
    confirmationDialogResolve = resolve
  })
}

function onConfirmationDialogOk() {
  settleConfirmationDialog(true)
}

function onConfirmationDialogCancel() {
  settleConfirmationDialog(false)
}

function openEquipmentModal(token) {
  if (!token?.hasModal || gameplayInputLocked.value || !isHumanTurn.value || dungeonOutcomeDialogOpen.value) return
  selectedEquipmentTokenId.value = token.equipmentId
  equipmentModalOpen.value = true
}

function takeEquipmentUseAction() {
  if (!selectedEquipmentModalView.value?.useAction) return
  takeHumanAction(selectedEquipmentModalView.value.useAction)
}

async function startNewMatchIntentional() {
  const shouldStartFresh = await requestConfirmation({
    title: 'Start a new match?',
    message: 'This will discard your current match and return to setup.',
    okLabel: 'Start new',
    cancelLabel: 'Cancel',
  })
  if (!shouldStartFresh) return
  backToSetup()
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
  const trace = aiTurnTrace()
  if (aiTurnInFlight) {
    trace('run.skip', { reason: 'in-flight' })
    return
  }
  if (gameplayInputLocked.value) {
    trace('run.skip', {
      reason: 'gameplay-locked',
      activePresentation: activePresentation.value?.kind ?? null,
      queueMs: presentationOrchestrator.getQueueSnapshot().reduce((sum, item) => sum + item.remainingMs, 0),
    })
    return
  }
  if (
    !match.value ||
    (match.value.state.phase !== 'bidding' &&
      match.value.state.phase !== 'dungeon' &&
      match.value.state.phase !== 'pick-adventurer')
  ) {
    trace('run.skip', { reason: 'phase-not-actionable', phase: match.value?.state?.phase ?? null })
    return
  }
  const seatId = match.value.state.turn.activeSeatId
  if (!seatId || seatId === humanSeatId.value) {
    trace('run.skip', { reason: 'not-ai-seat', seatId, humanSeatId: humanSeatId.value })
    return
  }
  const runToken = buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
  if (runToken === lastAppliedAiTurnToken) {
    trace('run.skip', { reason: 'duplicate-token', runToken, lastAppliedAiTurnToken })
    return
  }
  aiTurnInFlight = true
  try {
  trace('run.begin', {
    runToken,
    phase: match.value.state.phase,
    seatId,
    turnNumber: match.value.state.turn.turnNumber,
    biddingSubphase: match.value.state.bidding?.subphase ?? null,
    revealedMonsterCard: match.value.state.bidding?.revealedMonsterCard ?? null,
    dungeonSubphase: match.value.state.dungeon?.subphase ?? null,
  })
  const seat = match.value.state.seats.find((candidate) => candidate.id === seatId)
  const roleType = seat?.role?.type
  let action = null
  if (roleType === 'nn') {
    const modelId = seat.role.modelId ?? 'latest'
    if (nnFailureRecovery.isCoolingDown(modelId)) {
      trace('choose.randombot', { reason: 'model-cooldown', modelId })
      action = chooseRandombotAction(match.value.state, { seatId })
    } else {
      await ensureNnModelsReady()
      action = await consumeAiTurnPrefetch(runToken, (step, detail) => trace(step, detail))
      if (action) {
        trace('choose.prefetch-hit', { modelId, actionType: action.type })
      } else {
        trace('choose.nn.begin', { modelId })
        action = await chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(modelId))
        trace('choose.nn.done', { modelId, actionType: action?.type ?? null, fallbackReason: action?.meta?.fallbackReason ?? null })
      }
      if (action?.meta?.fallbackReason === 'MODEL_LOAD_FAILED') {
        // Use the safe fallback for this turn; recovery UI must not block the AI pipeline.
        void handleNnModelFailure(seat, modelId, seatId, action)
      }
    }
  } else {
    trace('choose.randombot', { seatId })
    action = chooseRandombotAction(match.value.state, { seatId })
  }
  if (!action) {
    trace('choose.empty', { seatId, roleType })
    action = chooseRandombotAction(match.value.state, { seatId })
  }
  if (!action) {
    trace('run.abort', { reason: 'no-action' })
    return
  }
  if (!match.value) {
    trace('run.abort', { reason: 'match-cleared' })
    return
  }
  const currentToken = buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
  if (runToken !== currentToken) {
    trace('run.abort', { reason: 'stale-token', runToken, currentToken })
    return
  }
  const prevState = match.value.state
  if (humanSeatId.value) {
    previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
  }
  const result = applyAction(prevState, action, { seatId })
  if (!result.ok) {
    trace('run.abort', { reason: 'apply-failed', actionType: action.type })
    return
  }
  lastAppliedAiTurnToken = runToken
  const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
  if (deferExit) {
    deferredPostDungeonState.value = result.state
    match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
  } else {
    deferredPostDungeonState.value = null
    match.value = { ...match.value, state: result.state }
  }
  trace('run.applied', {
    actionType: action.type,
    nextRunToken: buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state }),
    phaseAfter: match.value.state.phase,
    turnAfterSeatId: match.value.state.turn.activeSeatId,
    deferExit,
  })
  enqueuePresentationTransition(prevState, result.state, action, seatId, roleType ?? 'randombot')
  if (debugMode.value) {
    const snap = presentationOrchestrator.getQueueSnapshot()
    trace('presentation.enqueued', {
      queue: snap.map((item) => item.kind),
      queueMs: snap.reduce((sum, item) => sum + item.remainingMs, 0),
    })
  }
  primeAiTurnPrefetch()
  } finally {
    aiTurnInFlight = false
    trace('run.finally', { inFlight: false })
  }
}

function primeAiTurnPrefetch() {
  const trace = aiTurnTrace()
  if (!match.value || isHumanTurn.value) {
    logAiTurnPrimeSkip(!match.value ? 'no-match' : 'human-turn')
    return
  }
  const state = match.value.state
  const seatId = state.turn?.activeSeatId
  if (!seatId || seatId === humanSeatId.value) {
    logAiTurnPrimeSkip('not-ai-seat', { seatId })
    return
  }
  if (
    state.phase !== 'bidding' &&
    state.phase !== 'dungeon' &&
    state.phase !== 'pick-adventurer'
  ) {
    logAiTurnPrimeSkip('phase', { phase: state.phase })
    return
  }
  const runToken = buildAiTurnRunToken({ matchId: match.value.id, state })
  if (!runToken || runToken === lastAppliedAiTurnToken) {
    logAiTurnPrimeSkip('token-not-ready', { runToken })
    return
  }
  const seat = state.seats.find((candidate) => candidate.id === seatId)
  if (seat?.role?.type !== 'nn') {
    logAiTurnPrimeSkip('not-nn-seat', { roleType: seat?.role?.type ?? null })
    return
  }
  lastPrimeSkipTraceKey = ''
  const modelId = seat.role.modelId ?? 'latest'
  startAiTurnPrefetch({
    runToken,
    trace: (step, detail) => trace(step, detail),
    compute: async () => {
      await ensureNnModelsReady()
      return chooseNnActionWithFallback(state, { seatId }, nnRuntimeOptions(modelId))
    },
  })
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
      biddingBefore:
        prevState.phase === MATCH_PHASES.BIDDING
          ? {
              revealedMonsterCard: prevState.bidding?.revealedMonsterCard ?? null,
              revealedBySeatId: prevState.bidding?.revealedBySeatId ?? null,
            }
          : null,
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
  const rawDefeatRecord = dungeonState.lastDefeatRecord ?? null
  const lastDefeatRecord = rawDefeatRecord
    ? {
        monsterCard: rawDefeatRecord.monsterCard ?? null,
        byEquipmentIds: Array.isArray(rawDefeatRecord.byEquipmentIds) ? [...rawDefeatRecord.byEquipmentIds] : [],
        expendedEquipmentIds: Array.isArray(rawDefeatRecord.expendedEquipmentIds)
          ? [...rawDefeatRecord.expendedEquipmentIds]
          : [],
      }
    : null
  return {
    subphase: dungeonState.subphase ?? null,
    currentMonster: dungeonState.currentMonster ?? null,
    remainingMonsterCount: Array.isArray(dungeonState.remainingMonsters)
      ? dungeonState.remainingMonsters.length
      : 0,
    discardedMonsterCount: discardedRunMonsterIds.length,
    discardedRunMonsterIds,
    hp: Number.isFinite(dungeonState.hp) ? dungeonState.hp : null,
    lastDefeatRecord,
  }
}

function enrichPresentationForViewer(head) {
  if (!head) return null
  const kind = head.kind
  const basePayload = head.payload && typeof head.payload === 'object' ? { ...head.payload } : {}

  if (kind === 'BIDDING_DRAW') {
    const actorSeatId = basePayload.actorSeatId ?? null
    basePayload.shouldFlipFaceAfterArrival = viewerMaySeeBiddingDrawFace({
      viewerSeatId: humanSeatId.value,
      actorSeatId,
    })
    return { ...head, payload: basePayload }
  }
  if (kind === 'BIDDING_ADD') {
    basePayload.shouldFlipToBackBeforeDungeon = viewerMaySeeAddToDungeonFlipDown({
      viewerSeatId: humanSeatId.value,
      actorSeatId: basePayload.actorSeatId ?? null,
      actorRoleType: basePayload.actorRoleType ?? null,
    })
    return { ...head, payload: basePayload }
  }
  return head
}

function syncPresentationLabel() {
  activePresentation.value = enrichPresentationForViewer(presentationOrchestrator.getActiveAnimation())
  activePresentationLabel.value = activePresentation.value?.label ?? ''
  const locked = presentationOrchestrator.isGameplayInputLocked()
  gameplayInputLocked.value = locked
  if (presentationInputWasLocked && !locked) {
    lastScheduleSkipKey = ''
    lastPrimeSkipTraceKey = ''
    if (debugMode.value) {
      const snap = presentationOrchestrator.getQueueSnapshot()
      aiTurnTrace()('presentation.unlock', {
        queuedKinds: snap.map((item) => item.kind),
        isHumanTurn: isHumanTurn.value,
        activeSeatId: match.value?.state?.turn?.activeSeatId ?? null,
      })
    }
    scheduleAiTurnIfReady()
    scheduleHumanAutoResolveIfReady()
  }
  presentationInputWasLocked = locked
  if (presentationTraceEnabled()) {
    const a = activePresentation.value
    const key = a ? `${a.id}:${a.kind}` : 'idle'
    if (key !== lastPresentationTraceKey) {
      lastPresentationTraceKey = key
      const snap = presentationOrchestrator.getQueueSnapshot()
      const d = match.value?.state?.dungeon
      console.log('[DungeonRunner][presentation] active', a?.kind ?? 'idle', {
        ms: a?.remainingMs ?? null,
        queued: snap.map((x) => x.kind),
        inputLocked: gameplayInputLocked.value,
        engineDungeonCurrentMonster: d?.currentMonster ?? null,
        engineDungeonSubphase: d?.subphase ?? null,
        viewMonsterVisibility: showDungeonStage.value ? dungeonStageView.value.monster.visibility : null,
        viewMonsterSpecies: showDungeonStage.value ? dungeonStageView.value.monster.species : null,
      })
    }
  }
}

function humanDungeonAutoRevealGapMs() {
  const pace = presentationSpeedProfile.value
  const profile = SPEED_PROFILES[pace] ?? SPEED_PROFILES.cinematic
  return Math.max(0, profile.dungeonContinueMs)
}

function scheduleAiTurnIfReady() {
  if (aiTurnInFlight) {
    logAiTurnScheduleSkip('in-flight')
    return
  }
  if (deferredPostDungeonState.value) {
    logAiTurnScheduleSkip('deferred-post-dungeon')
    return
  }
  if (!match.value || isHumanTurn.value) {
    return
  }
  if (gameplayInputLocked.value) {
    const snap = presentationOrchestrator.getQueueSnapshot()
    const runToken = buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
    logAiTurnScheduleSkip('gameplay-locked', {
      activeKind: snap[0]?.kind ?? null,
      queueMs: snap.reduce((sum, item) => sum + item.remainingMs, 0),
      queueKinds: snap.map((item) => item.kind),
      runToken,
    })
    primeAiTurnPrefetch()
    if (aiTurnTimerId) {
      window.clearTimeout(aiTurnTimerId)
      aiTurnTimerId = null
    }
    return
  }
  primeAiTurnPrefetch()
  if (
    match.value.state.phase !== 'bidding' &&
    match.value.state.phase !== 'dungeon' &&
    match.value.state.phase !== 'pick-adventurer'
  ) {
    logAiTurnScheduleSkip('phase-not-actionable', { phase: match.value.state.phase })
    return
  }
  const runToken = buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
  if (runToken && runToken === lastAppliedAiTurnToken) {
    logAiTurnScheduleSkip('already-applied-token', { runToken })
    return
  }
  if (aiTurnTimerId) {
    logAiTurnScheduleSkip('timer-pending', { runToken })
    return
  }
  if (debugMode.value) {
    aiTurnTrace()('schedule.timer-armed', { runToken, delayMs: AI_TURN_SCHEDULE_DELAY_MS })
  }
  aiTurnTimerId = window.setTimeout(() => {
    aiTurnTimerId = null
    if (debugMode.value) aiTurnTrace()('schedule.timer-fired', { runToken })
    void runAiTurn()
  }, AI_TURN_SCHEDULE_DELAY_MS)
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
  }, humanDungeonAutoRevealGapMs())
}

async function handleNnModelFailure(seat, modelId, seatId, fallbackAction) {
  nnFailureRecovery.recordFailure(modelId)
  const downgradeTarget = getDowngradeModelId(modelId)
  const wantsRetry = await requestConfirmation({
    title: 'Model load failed',
    message: `Model "${modelId}" failed to load. Retry once?`,
    okLabel: 'Retry',
    cancelLabel: 'Recovery options',
  })
  if (wantsRetry) {
    return chooseNnActionWithFallback(match.value.state, { seatId }, nnRuntimeOptions(modelId))
  }
  if (downgradeTarget) {
    const wantsDowngrade = await requestConfirmation({
      title: 'Downgrade model?',
      message: `Downgrade to "${downgradeTarget}"?`,
      okLabel: 'Downgrade',
      cancelLabel: 'Use safe fallback',
    })
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
    pipelineTrace: true,
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

function skipActivePresentation() {
  presentationOrchestrator.skipActiveAnimation()
  syncPresentationLabel()
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
    dungeonRunnerSettingsStore.setAnimationPace(pace)
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
  min-width: 0;
  width: 100%;
  overflow: hidden;
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

.dr-header-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.dr-hero-pick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.dr-hero-pick-grid__btn {
  min-height: 3rem;
}

.dr-bidding-board {
  position: relative;
  z-index: 0;
  isolation: isolate;
  border-radius: 10px;
  overflow: hidden;
}

.dr-dungeon-hp-bar {
  border: 1px solid rgba(244, 67, 54, 0.35);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(31, 13, 13, 0.86);
}

.dr-dungeon-hp-bar__track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.dr-dungeon-hp-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #b71c1c, #f44336);
  transition: width 180ms ease;
}

.dr-pile-badge {
  background-image: linear-gradient(180deg, rgba(42, 42, 42, 0.92), rgba(58, 58, 58, 0.9)), var(--dr-pile);
  background-size: auto, 150% auto;
  background-position: center, 50% 45%;
  background-repeat: no-repeat;
}

.dr-equip-token {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  outline: none;
}

.dr-equip-token__plate,
.dr-equip-token__symbol {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.dr-equip-token__plate {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dr-equip-token__symbol {
  width: 72%;
  height: 72%;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  object-fit: contain;
  filter: drop-shadow(0 0 0.5px rgba(0, 0, 0, 0.35));
}

.dr-equip-token__overlay {
  position: absolute;
  right: 0;
  bottom: 2px;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  -webkit-text-stroke: 0.85px rgba(18, 18, 18, 0.92);
  paint-order: stroke fill;
  color: rgba(18, 18, 18, 0.92);
  text-shadow:
    0 0 12px rgba(255, 255, 255, 0.98),
    0 0 6px rgba(255, 255, 255, 0.95);
  pointer-events: none;
}

.dr-equip-token--spent {
  opacity: 0.55;
}

.dr-equip-token--interactive {
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
  width: 100%;
}

.dr-seat-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dr-seat-progress-cell {
  min-height: 1.25rem;
  padding: 0 4px;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.dr-seat-progress-marker {
  font-weight: 700;
  margin-right: 2px;
}

.dr-seat-progress-marker--success {
  color: #66bb6a;
}

.dr-seat-progress-marker--failure {
  color: #ef5350;
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

.dr-equip-token--deemphasized {
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

.dr-hero-interstitial__headline {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 500;
  text-align: center;
}

.dr-hero-interstitial__avatar {
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

.dr-hero-interstitial__hint {
  font-size: 0.85rem;
  opacity: 0.75;
}

.dr-dungeon-outcome-dialog,
.dr-match-over-dialog {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.dr-outcome--success {
  background:
    radial-gradient(120% 100% at 0% 0%, rgba(102, 187, 106, 0.22), rgba(102, 187, 106, 0) 60%),
    radial-gradient(120% 120% at 100% 100%, rgba(41, 182, 246, 0.2), rgba(41, 182, 246, 0) 62%),
    #171b1f;
}

.dr-outcome--failure {
  background:
    radial-gradient(120% 100% at 0% 0%, rgba(239, 83, 80, 0.24), rgba(239, 83, 80, 0) 58%),
    radial-gradient(120% 120% at 100% 100%, rgba(171, 71, 188, 0.2), rgba(171, 71, 188, 0) 62%),
    #1b161c;
}

.dr-outcome-kicker {
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.72);
}

.dr-outcome-title {
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}

.dr-outcome-message {
  color: rgba(255, 255, 255, 0.86);
}

.dr-outcome-btn {
  letter-spacing: 0.03em;
}

.dr-outcome-btn-secondary {
  color: rgba(255, 255, 255, 0.86);
}
</style>

<style>
/* Quasar portals dialogs outside scoped tree; keep equipment modal above board texture & memory-aid layers */
.dr-equipment-dialog .q-dialog__inner {
  z-index: 9000 !important;
}
</style>
