<template>
  <div :data-testid="LIVE_MATCH_SHELL_TEST_IDS.root">
    <div :ref="session.board.bindBoardShellRef" class="dr-board-shell">
      <div
        v-if="session.board.showDungeonStage && session.board.dungeonStageView.hpBar"
        class="dr-dungeon-hp-bar q-mb-sm"
        role="meter"
        aria-label="Adventurer HP"
        aria-valuemin="0"
        :aria-valuemax="session.board.dungeonStageView.hpBar.displayMaxHp"
        :aria-valuenow="session.board.dungeonStageView.hpBar.currentHp"
      >
        <div class="row items-center justify-between q-mb-xs">
          <span class="text-caption text-weight-medium">HP</span>
          <span class="text-caption">{{ session.board.dungeonStageView.hpBar.text }}</span>
        </div>
        <div class="dr-dungeon-hp-bar__track">
          <div
            class="dr-dungeon-hp-bar__fill"
            :style="{ width: `${session.board.dungeonStageView.hpBar.percent}%` }"
          />
        </div>
      </div>
      <q-card
        flat
        bordered
        class="q-pa-sm q-mb-sm dr-bidding-board"
        :class="session.board.biddingBoard.heroCue.accentClass"
      >
      <div
        v-if="session.board.seatRunTrackerRows.length"
        class="dr-seat-strip q-mb-sm"
      >
        <div class="row q-col-gutter-xs">
          <div v-for="row in session.board.seatRunTrackerRows" :key="`seat-${row.seatId}`" class="col dr-seat-stack">
            <q-badge
              :color="row.passed ? 'grey-9' : session.board.biddingBoard.heroCue.badgeColor"
              text-color="white"
              class="dr-seat-chip q-px-sm full-width"
              :class="{ 'dr-token-glow': row.isActive }"
            >
              <span class="text-caption">{{ row.label }}</span>
            </q-badge>
            <div
              v-if="row.recovering"
              class="row items-center justify-center q-mt-xs"
              :data-testid="row.recoveryTestId"
            >
              <q-spinner size="16px" color="primary" />
            </div>
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
          :ref="session.board.bindHeroCardSlotRef"
          class="dr-hero-card-slot"
          :class="{
            'dr-dungeon-stage': session.board.showDungeonStage,
            [session.board.dungeonStageAnimationClass]: session.board.showDungeonStage && session.board.dungeonStageAnimationClass,
          }"
        >
          <div :ref="session.board.bindDungeonCardMotionWrapRef" class="dr-dungeon-card-motion-wrap">
            <MonsterCardFace
              :ref="session.board.bindDungeonCardFaceRef"
              class="dr-hero-card-control"
              :empty="session.board.monsterCardSlotEmpty"
              :hide-empty-slot="session.board.showDungeonStage"
              :species="session.board.showDungeonStage ? session.board.dungeonStageView.monster.frontFaceSpecies : session.board.biddingStageSpecies"
              :face-down="
                session.board.showDungeonStage
                  ? session.board.dungeonStageView.monster.visibility === 'face-down'
                  : session.board.biddingStageFaceDown
              "
            />
          </div>
          <q-badge
            v-if="session.board.showDungeonStage && session.board.dungeonStageView.hpDelta"
            class="dr-dungeon-stage__hp-chip"
            :color="session.board.dungeonStageView.hpDelta.tone === 'damage' ? 'negative' : 'positive'"
            text-color="white"
          >
            {{ session.board.dungeonStageView.hpDelta.text }}
          </q-badge>
        </div>
      </q-card-section>
      <div class="row q-col-gutter-xs items-start">
        <div class="col-4">
          <q-badge
            :ref="session.board.bindDeckBadgeRef"
            text-color="white"
            class="full-width q-py-xs justify-between dr-deck-badge dr-pile-badge dr-pile-badge--deck"
            :style="{ '--dr-pile': `url('${session.board.uiAssets.piles.deck.runtimePath}')` }"
            :class="{
              'dr-deck-badge--interactive': session.board.biddingBoard.memoryAid.deckTapEnabled,
            }"
            @click="session.board.onDeckTap"
          >
            <span>Deck</span>
            <span>{{ session.board.biddingBoard.secondary.deckCount }}</span>
          </q-badge>
          <div v-if="session.board.biddingBoard.memoryAid.knownDeckCountHint !== null" class="text-caption text-grey-6 q-mt-xs">
            Known to you: {{ session.board.biddingBoard.memoryAid.knownDeckCountHint }}
          </div>
        </div>
        <div class="col-4">
          <div :ref="session.board.bindDungeonPileMotionAnchorRef" class="full-width">
            <q-badge
              text-color="white"
              class="full-width q-py-xs justify-between dr-pile-badge dr-pile-badge--dungeon"
              :style="{ '--dr-pile': `url('${session.board.uiAssets.piles.dungeon.runtimePath}')` }"
            >
              <span>Dungeon</span>
              <span>{{ session.board.biddingBoard.secondary.dungeonCount }}</span>
            </q-badge>
          </div>
        </div>
        <div class="col-4">
          <div class="row no-wrap items-center full-width dr-turn-hero-row">
            <q-chip
              :color="session.board.biddingBoard.heroCue.badgeColor"
              text-color="white"
              dense
              :aria-label="session.board.biddingBoard.heroCue.shortLabel"
            >
              {{ session.board.biddingBoard.heroCue.shortLabel }}
            </q-chip>
          </div>
        </div>
      </div>
      <div class="row q-mt-none">
        <div
          v-for="token in session.board.boardEquipmentTokens"
          :key="token.equipmentId"
          class="col-4 flex flex-center"
        >
          <div
            :ref="(el) => session.board.bindBiddingEquipmentBadgeRef(token.equipmentId, el)"
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
            @click="session.board.openEquipmentModal(token)"
            @keydown.enter.prevent="session.board.openEquipmentModal(token)"
            @keydown.space.prevent="session.board.openEquipmentModal(token)"
          >
            <img
              class="dr-equip-token__plate"
              :src="session.board.uiAssets.equipment.plate.runtimePath"
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
    
    <q-card v-if="session.board.showActionPane" flat bordered class="q-pa-sm q-mb-md">
      <div v-if="session.board.activePresentationLabel" class="text-body2 text-grey-6 q-mb-xs">{{ session.board.activePresentationLabel }}</div>
      <div v-if="session.board.isHumanTurn" class="row q-col-gutter-sm q-gutter-y-sm">
        <template v-if="session.board.match?.state?.phase === 'bidding' && session.board.biddingSacrificeActions.length > 1">
          <q-btn
            v-for="action in session.board.biddingNonSacrificeActions"
            :key="session.board.actionKey(action)"
            :color="session.board.biddingBoard.heroCue.buttonColor"
            unelevated
            no-caps
            size="lg"
            class="col-12 col-sm-auto"
            :label="session.board.actionLabel(action)"
            :disable="session.board.humanGameplayBlocked"
            @click="session.board.takeHumanAction(action)"
          />
          <q-btn-dropdown
            :color="session.board.biddingBoard.heroCue.buttonColor"
            unelevated
            no-caps
            dense
            size="lg"
            class="col-12 col-sm-auto"
            label="Sacrifice equipment"
            :disable="session.board.humanGameplayBlocked"
          >
            <q-list dense>
              <q-item
                v-for="action in session.board.biddingSacrificeActions"
                :key="session.board.actionKey(action)"
                v-close-popup
                clickable
                @click="session.board.takeHumanAction(action)"
              >
                <q-item-section>{{ session.board.actionLabel(action) }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </template>
        <template v-else>
          <template v-if="session.board.showHeroPickActionGrid">
            <div class="col-12 text-h5 text-weight-medium text-grey-5 q-mb-xs" style="text-align: center;">Select Adventurer</div>
            <div class="dr-hero-pick-grid col-12">
              <q-btn
                v-for="action in session.board.heroPickActionsOrdered"
                :key="session.board.actionKey(action)"
                :color="session.board.getAdventurerIdentity(action.hero).buttonColor"
                unelevated
                no-caps
                dense
                size="lg"
                class="dr-hero-pick-grid__btn full-width"
                :label="session.board.getAdventurerIdentity(action.hero).shortLabel"
                :aria-label="session.board.actionLabel(action)"
                :disable="session.board.humanGameplayBlocked"
                @click="session.board.takeHumanAction(action)"
              />
            </div>
          </template>
          <template v-else>
            <q-btn
              v-for="action in session.board.visiblePrimaryActions"
              :key="session.board.actionKey(action)"
              :color="session.board.biddingBoard.heroCue.buttonColor"
              unelevated
              no-caps
              dense
              size="lg"
              class="col-12 col-sm-auto"
              :label="session.board.actionLabel(action)"
              :disable="session.board.humanGameplayBlocked"
              @click="session.board.takeHumanAction(action)"
            />
          </template>
        </template>
      </div>
      <div v-if="session.board.isHumanTurn && session.board.dungeonOutcomeTransitionControls.length" class="row q-col-gutter-sm q-gutter-y-sm q-mt-xs">
        <q-btn
          v-for="control in session.board.dungeonOutcomeTransitionControls"
          :key="control.key"
          :color="session.board.biddingBoard.heroCue.buttonColor"
          unelevated
          no-caps
          dense
          size="md"
          class="col-12 col-sm-auto"
          :label="control.label"
          :disable="session.board.gameplayInputLocked || session.dialogs.dungeonOutcomeDialogOpen"
          @click="session.board.takeHumanAction(control.action)"
        />
      </div>
    </q-card>
    
    <q-card v-if="session.debug.debugMode" flat bordered class="q-pa-md q-mb-md">
      <div class="text-subtitle2 q-mb-sm">Debug replay</div>
      <div v-if="session.debug.nnDebugTraceHistory.length" class="q-mb-sm">
        <div class="text-caption text-grey-5 q-mb-xs">NN trace history</div>
        <div v-for="(entry, index) in session.debug.nnDebugTraceHistory" :key="`nn-trace-${index}`" class="text-caption">
          {{ entry.at }} | {{ entry.modelId }} | {{ entry.trace.kind }} |
          {{ entry.trace.fallbackReason ?? entry.trace.mode ?? 'sample' }}
        </div>
      </div>
      <div class="row q-gutter-sm q-mb-sm">
        <q-btn color="primary" flat label="Export replay" @click="session.debug.exportReplay" />
        <q-btn color="primary" flat label="Import replay" @click="session.debug.importReplay" />
      </div>
      <q-input
        v-model="session.debug.replayExportText"
        type="textarea"
        autogrow
        readonly
        label="Export payload"
        outlined
        dense
        class="q-mb-sm"
      />
      <q-input v-model="session.debug.replayImportText" type="textarea" autogrow label="Import payload" outlined dense />
      <q-input
        v-model="session.debug.nnDebugTraceText"
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
        :ref="session.board.bindPresentationFlightLayerRef"
        class="dr-presentation-flight-layer"
        aria-hidden="true"
      />
    </div>

    <button
      v-if="session.board.activePresentation?.kind === 'HERO_CHANGE_INTERSTITIAL' && session.board.heroChangeInterstitialView"
      :ref="session.board.bindHeroChangeInterstitialOverlayRef"
      type="button"
      class="dr-hero-interstitial"
      :aria-label="session.board.heroChangeInterstitialAriaLabel"
      @click="session.board.skipActivePresentation"
    >
      <p class="dr-hero-interstitial__headline">{{ session.board.heroChangeInterstitialView.headline }}</p>
      <q-avatar
        :color="session.board.heroChangeInterstitialView.chosen.badgeColor"
        text-color="white"
        size="56px"
        font-size="1.25rem"
        class="dr-hero-interstitial__avatar"
      >
        {{ session.board.heroChangeInterstitialView.chosen.badgeGlyph }}
      </q-avatar>
    </button>
    
    <q-dialog v-model="session.dialogs.dungeonOutcomeDialogOpen" persistent transition-show="scale" transition-hide="scale">
      <q-card class="q-pa-md dr-dungeon-outcome-dialog" :class="session.dialogs.dungeonOutcomeToneClass" style="min-width: 340px">
        <div class="text-overline dr-outcome-kicker">Dungeon run resolved</div>
        <div class="text-h5 text-weight-bold q-mb-sm dr-outcome-title">
          {{ session.dialogs.dungeonOutcomeSummary?.resultLabel }}
        </div>
        <div class="text-body1 q-mb-xs">
          Runner: <span class="text-weight-bold">{{ session.dialogs.dungeonOutcomeSummary?.runnerLabel }}</span>
        </div>
        <div class="text-body2 q-mb-md dr-outcome-message">{{ session.dialogs.dungeonOutcomeMessage }}</div>
        <div class="row justify-end">
          <q-btn color="primary" unelevated label="Continue" class="dr-outcome-btn" @click="session.dialogs.continueFromDungeonOutcome" />
        </div>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="session.dialogs.equipmentModalOpen" class="dr-equipment-dialog">
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">{{ session.dialogs.selectedEquipmentModalView?.title }}</div>
        <div class="text-body2 q-mb-md">{{ session.dialogs.selectedEquipmentModalView?.details }}</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn
            v-if="session.dialogs.selectedEquipmentModalView?.showUseButton"
            color="primary"
            unelevated
            label="Use"
            :disable="session.dialogs.equipmentModalActionsDisabled"
            @click="session.dialogs.takeEquipmentUseAction"
          />
          <q-btn flat color="primary" label="Continue" @click="session.dialogs.continueFromEquipmentModal" />
        </div>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="session.dialogs.confirmationDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">{{ session.dialogs.confirmationDialogTitle }}</div>
        <div class="text-body2 q-mb-md">{{ session.dialogs.confirmationDialogMessage }}</div>
        <div class="row justify-end q-gutter-sm">
          <q-btn flat color="primary" :label="session.dialogs.confirmationDialogCancelLabel" @click="session.dialogs.onConfirmationDialogCancel" />
          <q-btn color="primary" unelevated :label="session.dialogs.confirmationDialogOkLabel" @click="session.dialogs.onConfirmationDialogOk" />
        </div>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="session.dialogs.neuralRefreshTerminalOpen" persistent :data-testid="LIVE_MATCH_SHELL_TEST_IDS.neuralRefreshTerminal">
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">Neural opponent unavailable</div>
        <div class="text-body2 q-mb-md">
          Inference could not recover. Refresh the page to reload the neural runtime; your match stays saved.
        </div>
        <div class="row justify-end">
          <q-btn
            color="primary"
            unelevated
            label="Refresh page"
            :data-testid="LIVE_MATCH_SHELL_TEST_IDS.neuralRefreshTerminalReload"
            @click="session.dialogs.reloadPageForNeuralRefreshTerminal"
          />
        </div>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="session.dialogs.vorpalDialogOpen" persistent>
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">Vorpal target</div>
        <div class="text-body2 q-mb-md">Choose a species before entering the dungeon.</div>
        <q-select
          v-model="session.dialogs.selectedVorpalSpecies"
          :options="session.dialogs.vorpalSelectOptions"
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
            :disable="!session.dialogs.selectedVorpalSpecies || session.board.humanGameplayBlocked"
            @click="session.dialogs.confirmVorpalDeclaration"
          />
        </div>
      </q-card>
    </q-dialog>
    <q-dialog v-model="session.dialogs.deckSplayOpen" maximized>
      <q-card class="dr-deck-splay-panel">
        <div class="row items-center q-px-md q-pt-md q-pb-sm">
          <div class="text-subtitle1">Deck splay</div>
          <q-space />
          <q-btn flat dense icon="close" aria-label="Close deck splay" @click="session.dialogs.onCloseDeckSplay" />
        </div>
        <q-separator />
        <div class="q-pa-md dr-deck-splay-scroll">
          <div class="row q-col-gutter-sm q-row-gutter-sm">
            <div
              v-for="(slot, index) in session.board.biddingBoard.memoryAid.deckSplayCards"
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
    
    <q-inner-loading
      :showing="session.board.headlessCompletionInFlight"
      :data-testid="LIVE_MATCH_SHELL_TEST_IDS.finishingMatchOverlay"
      class="dr-finishing-match-overlay"
    >
      <q-spinner size="50px" color="primary" />
    </q-inner-loading>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { LIVE_MATCH_SHELL_TEST_IDS } from './liveMatchShellTestIds.js'
import { LIVE_MATCH_SHELL_SESSION_KEY } from './liveMatchShellSessionKey.js'
import MonsterCardFace from '../../../../components/dungeon-runner/MonsterCardFace.vue'

const session = inject(LIVE_MATCH_SHELL_SESSION_KEY)
</script>

<style scoped>

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
/* Quasar portals dialogs outside scoped tree; above presentation ghost flights (z-index 10050) */
.dr-equipment-dialog .q-dialog__inner {
  z-index: 10100 !important;
}
</style>
