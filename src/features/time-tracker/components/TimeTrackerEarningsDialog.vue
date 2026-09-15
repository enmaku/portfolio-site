<template>
  <q-dialog :model-value="open" persistent @update:model-value="onDialogUpdate">
    <q-card class="tt-dialog-card">
      <q-card-section class="column q-gutter-y-sm">
        <q-input
          v-model="amountInput"
          type="number"
          step="0.01"
          min="0"
          outlined
          dense
          label="Earnings (USD)"
          data-testid="tt-earnings-input"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps color="grey" label="Skip" data-testid="tt-earnings-skip" @click="onSkip" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Continue"
          data-testid="tt-earnings-continue"
          @click="onContinue"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { usdInputToCents } from '../formatDisplay.js'

const props = defineProps({
  open: { type: Boolean, required: true },
})

const emit = defineEmits(['continue', 'skip'])

const amountInput = ref('')

watch(
  () => props.open,
  (next) => {
    if (next) amountInput.value = ''
  },
)

function onDialogUpdate(value) {
  if (!value) emit('skip')
}

function onSkip() {
  emit('skip')
}

function onContinue() {
  try {
    emit('continue', usdInputToCents(amountInput.value))
  } catch {
    emit('continue', null)
  }
}
</script>
