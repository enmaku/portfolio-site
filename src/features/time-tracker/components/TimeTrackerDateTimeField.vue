<template>
  <q-input
    class="tt-datetime-field"
    :model-value="displayValue"
    outlined
    dense
    readonly
    :label="label"
    :data-testid="testId"
    @click="openPicker"
  >
    <template #append>
      <q-icon name="event" color="grey-5" class="cursor-pointer" @click.stop="openPicker" />
    </template>
  </q-input>

  <q-dialog v-model="pickerOpen" persistent>
    <q-card class="tt-dialog-card">
      <q-tabs v-model="tab" dense active-color="primary" indicator-color="primary" align="justify">
        <q-tab name="date" icon="event" label="Date" />
        <q-tab name="time" icon="schedule" label="Time" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="tab" animated>
        <q-tab-panel name="date" class="q-pa-none">
          <q-date v-model="draft" flat mask="YYYY-MM-DDTHH:mm" />
        </q-tab-panel>
        <q-tab-panel name="time" class="q-pa-none">
          <q-time v-model="draft" flat mask="YYYY-MM-DDTHH:mm" />
        </q-tab-panel>
      </q-tab-panels>
      <q-card-actions align="right">
        <q-btn flat no-caps color="grey" label="Cancel" @click="pickerOpen = false" />
        <q-btn
          v-if="tab === 'date'"
          unelevated
          no-caps
          color="primary"
          label="Next"
          @click="tab = 'time'"
        />
        <q-btn
          v-else
          unelevated
          no-caps
          color="primary"
          label="Done"
          @click="confirmPicker"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatLocalDateTimeLabel } from '../formatDisplay.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  testId: { type: String, default: undefined },
})

const emit = defineEmits(['update:modelValue'])
const pickerOpen = ref(false)
const draft = ref('')
const tab = ref('date')
const displayValue = computed(() => formatLocalDateTimeLabel(props.modelValue))

function openPicker() {
  draft.value = props.modelValue
  tab.value = 'date'
  pickerOpen.value = true
}

function confirmPicker() {
  emit('update:modelValue', draft.value)
  pickerOpen.value = false
}
</script>
