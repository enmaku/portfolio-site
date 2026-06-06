<template>
  <q-dialog
    :model-value="open"
    class="dr-vorpal-picker-dialog"
    :class="{ 'dr-vorpal-picker-dialog--desktop-frame': desktopFramePresentation.framed }"
    :style="desktopFramePresentation.dialogStyle"
    maximized
    persistent
  >
    <q-card class="dr-deck-splay-panel dr-vorpal-picker-panel">
      <div class="q-px-md q-pt-md q-pb-sm">
        <div class="text-subtitle1">Vorpal declaration</div>
        <div class="text-body2 q-mt-xs">
          Choose a species before the first monster is revealed.
        </div>
      </div>
      <q-separator />
      <div
        ref="vorpalPickerScrollEl"
        class="q-pa-md dr-deck-splay-scroll dr-vorpal-picker-scroll"
        :class="{ 'dr-vorpal-picker-scroll--dragging': vorpalPickerDragActive }"
        @pointerdown="onVorpalPickerPointerDown"
        @pointermove="onVorpalPickerPointerMove"
        @pointerup="onVorpalPickerPointerEnd"
        @pointercancel="onVorpalPickerPointerEnd"
      >
        <div
          class="dr-vorpal-picker-hand"
          :class="{
            'dr-vorpal-picker-hand--has-selection': pickerView.hasSelection,
          }"
        >
          <button
            v-for="card in pickerView.handCards"
            :key="`vorpal-picker-${card.species}`"
            type="button"
            class="dr-vorpal-picker-card"
            :class="{
              'dr-vorpal-picker-card--selected': card.layoutRole === 'selected',
              'dr-vorpal-picker-card--isolated': card.layoutRole === 'selected',
              'dr-vorpal-picker-card--below-break': card.layoutRole === 'below-break',
              'dr-vorpal-picker-card--below': card.layoutRole === 'below',
            }"
            :disabled="!card.selectable"
            :data-testid="`${LIVE_MATCH_SHELL_TEST_IDS.vorpalPickerCard}-${card.species}`"
            @dragstart.prevent
            @pointerdown.stop="onVorpalPickerCardPointerDown"
            @click="onVorpalPickerCardTap(card.species)"
          >
            <div class="dr-vorpal-picker-card-stack">
              <MonsterCardFace class="dr-vorpal-picker-card-face" :species="card.species" />
              <div
                v-if="card.memoryAidCaption"
                class="text-caption text-center dr-vorpal-picker-caption"
              >
                Added to dungeon: {{ card.memoryAidCaption }}
              </div>
            </div>
          </button>
        </div>
      </div>
      <q-separator />
      <div class="row justify-end q-pa-md dr-vorpal-picker-footer">
        <q-btn
          color="primary"
          unelevated
          label="Confirm"
          :disable="!pickerView.confirmEnabled"
          :data-testid="LIVE_MATCH_SHELL_TEST_IDS.vorpalPickerConfirm"
          @click="emit('confirm')"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import { getDesktopPhoneFrameLayout } from '../../../../layouts/projects/desktopPhoneFrame.js'
import { LIVE_MATCH_SHELL_TEST_IDS } from './liveMatchShellTestIds.js'
import MonsterCardFace from '../../../../components/dungeon-runner/MonsterCardFace.vue'

const $q = useQuasar()

const desktopFramePresentation = computed(() => {
  const frame = getDesktopPhoneFrameLayout({
    viewportWidthPx: $q.screen.width,
    viewportHeightPx: $q.screen.height,
  })
  if (!frame.active || frame.columnWidthPx == null || frame.columnHeightPx == null) {
    return { framed: false, dialogStyle: undefined }
  }

  const cardWidthPx = Math.min(400, Math.round(frame.columnWidthPx * 0.94))

  return {
    framed: true,
    dialogStyle: {
      '--dr-vorpal-picker-frame-width': `${frame.columnWidthPx}px`,
      '--dr-vorpal-picker-frame-height': `${frame.columnHeightPx}px`,
      '--dr-vorpal-picker-card-outer-width': `${cardWidthPx}px`,
    },
  }
})

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  pickerView: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['card-tap', 'confirm'])

const pickerView = toRef(props, 'pickerView')
const vorpalPickerScrollEl = ref(null)
const vorpalPickerDragActive = ref(false)
const vorpalPickerPanMoved = ref(false)
const vorpalPickerDragStart = {
  x: 0,
  y: 0,
  scrollTop: 0,
}

const VORPAL_PICKER_DRAG_THRESHOLD_PX = 4

function beginVorpalPickerDrag(event, captureEl) {
  const scrollEl = vorpalPickerScrollEl.value
  if (!scrollEl || !(captureEl instanceof Element)) return

  vorpalPickerDragActive.value = true
  vorpalPickerPanMoved.value = false
  vorpalPickerDragStart.x = event.clientX
  vorpalPickerDragStart.y = event.clientY
  vorpalPickerDragStart.scrollTop = scrollEl.scrollTop

  captureEl.setPointerCapture(event.pointerId)
}

function onVorpalPickerPointerDown(event) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return

  const scrollEl = vorpalPickerScrollEl.value
  if (!scrollEl) return

  beginVorpalPickerDrag(event, scrollEl)
}

function onVorpalPickerCardPointerDown(event) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLButtonElement)) return

  beginVorpalPickerDrag(event, event.currentTarget)
}

function onVorpalPickerPointerMove(event) {
  if (!vorpalPickerDragActive.value) return

  const scrollEl = vorpalPickerScrollEl.value
  if (!scrollEl) return

  const deltaY = event.clientY - vorpalPickerDragStart.y
  if (Math.abs(deltaY) <= VORPAL_PICKER_DRAG_THRESHOLD_PX) return

  vorpalPickerPanMoved.value = true
  scrollEl.scrollTop = vorpalPickerDragStart.scrollTop - deltaY
}

function onVorpalPickerPointerEnd() {
  vorpalPickerDragActive.value = false
}

function onVorpalPickerCardTap(species) {
  if (vorpalPickerPanMoved.value) {
    vorpalPickerPanMoved.value = false
    return
  }

  emit('card-tap', species)
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function centerVorpalPickerSelection() {
  const scrollEl = vorpalPickerScrollEl.value
  if (!scrollEl) return

  const selectedEl = scrollEl.querySelector('.dr-vorpal-picker-card--selected')
  if (!(selectedEl instanceof HTMLElement)) return

  const scrollRect = scrollEl.getBoundingClientRect()
  const selectedRect = selectedEl.getBoundingClientRect()
  const delta =
    selectedRect.top + selectedRect.height / 2 - (scrollRect.top + scrollRect.height / 2)

  scrollEl.scrollTo({
    top: scrollEl.scrollTop + delta,
    behavior: 'smooth',
  })
}

watch(
  () => pickerView.value.selectedSpecies,
  async (species) => {
    if (!species) return
    await nextTick()
    await waitForNextFrame()
    centerVorpalPickerSelection()
  },
)
</script>

<style scoped>
.dr-deck-splay-panel.dr-vorpal-picker-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0 auto;
  max-height: 100%;
  max-width: 100%;
  width: 100%;
}

.dr-deck-splay-scroll {
  overflow-y: auto;
}

.dr-vorpal-picker-scroll {
  flex: 1;
  min-height: 0;
}

@media (hover: hover) and (pointer: fine) {
  .dr-vorpal-picker-scroll {
    cursor: grab;
  }

  .dr-vorpal-picker-scroll--dragging {
    cursor: grabbing;
  }
}

.dr-vorpal-picker-hand {
  --dr-vorpal-picker-card-width: var(--dr-vorpal-picker-card-outer-width, min(400px, 94vw));
  --dr-vorpal-picker-card-height: calc(var(--dr-vorpal-picker-card-width) * 245 / 384);
  --dr-vorpal-picker-peek: 76px;
  --dr-vorpal-picker-hand-tail: calc(
    var(--dr-vorpal-picker-card-height) - var(--dr-vorpal-picker-peek) + 8px
  );
  --dr-vorpal-picker-below-gap: 0px;
  --dr-vorpal-picker-selection-inset: 7cqw;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 0 auto;
  padding: 8px 0 calc(24px + var(--dr-vorpal-picker-hand-tail));
  width: var(--dr-vorpal-picker-card-width);
}

.dr-vorpal-picker-card {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  height: var(--dr-vorpal-picker-peek);
  overflow: visible;
  padding: 0;
  position: relative;
  user-select: none;
  width: 100%;
  z-index: 1;
}

.dr-vorpal-picker-card :deep(img) {
  -webkit-user-drag: none;
}

.dr-vorpal-picker-card:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.dr-vorpal-picker-card-stack {
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
}

.dr-vorpal-picker-card-face {
  display: block;
  width: 100%;
}

.dr-vorpal-picker-card-face :deep(.dr-monster-card) {
  margin: 0;
  max-width: none;
  width: 100%;
}

.dr-vorpal-picker-card--isolated {
  height: auto;
  overflow: visible;
  position: relative;
  z-index: 2;
}

.dr-vorpal-picker-card--isolated .dr-vorpal-picker-card-stack {
  position: static;
}

.dr-vorpal-picker-card--below-break {
  margin-top: var(--dr-vorpal-picker-below-gap);
  overflow: visible;
  z-index: 1;
}

.dr-vorpal-picker-card--below {
  overflow: visible;
  z-index: 1;
}

.dr-vorpal-picker-card--selected .dr-vorpal-picker-card-face {
  isolation: isolate;
  position: relative;
}

.dr-vorpal-picker-card--selected .dr-vorpal-picker-card-face::before {
  border-radius: var(--dr-vorpal-picker-selection-inset);
  box-shadow:
    0 0 0 3px rgba(100, 181, 246, 0.8),
    0 0 0 6px rgba(66, 165, 245, 0.45),
    0 0 40px rgba(100, 181, 246, 0.55),
    0 0 60px rgba(66, 165, 245, 0.3);
  content: '';
  inset: var(--dr-vorpal-picker-selection-inset);
  pointer-events: none;
  position: absolute;
  z-index: 0;
}

.dr-vorpal-picker-card--selected .dr-vorpal-picker-card-face :deep(.dr-monster-card) {
  position: relative;
  z-index: 1;
}

.dr-vorpal-picker-caption {
  color: rgba(255, 255, 255, 0.75);
  margin-top: 4px;
}

.dr-vorpal-picker-footer {
  flex-shrink: 0;
}
</style>

<style>
/* Quasar `maximized` is viewport-sized; on md+ pin the sheet to the same px box as ProjectShellLayout. */
.dr-vorpal-picker-dialog--desktop-frame .q-dialog__inner,
.dr-vorpal-picker-dialog--desktop-frame .q-dialog__inner--maximized {
  bottom: auto !important;
  height: var(--dr-vorpal-picker-frame-height) !important;
  left: 50% !important;
  max-height: var(--dr-vorpal-picker-frame-height) !important;
  max-width: var(--dr-vorpal-picker-frame-width) !important;
  right: auto !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: var(--dr-vorpal-picker-frame-width) !important;
}
</style>
