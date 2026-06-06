<template>
  <q-dialog :model-value="open" maximized persistent>
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
            @click="emit('card-tap', card.species)"
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
import { nextTick, ref, toRef, watch } from 'vue'
import { LIVE_MATCH_SHELL_TEST_IDS } from './liveMatchShellTestIds.js'
import MonsterCardFace from '../../../../components/dungeon-runner/MonsterCardFace.vue'

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

.dr-vorpal-picker-panel {
  max-width: min(960px, 100vw);
}

.dr-vorpal-picker-scroll {
  flex: 1;
  min-height: 0;
}

.dr-vorpal-picker-hand {
  --dr-vorpal-picker-card-width: min(400px, 94vw);
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
  width: 100%;
  z-index: 1;
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
