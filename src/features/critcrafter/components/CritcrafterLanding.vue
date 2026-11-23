<script setup>
import { ref } from 'vue'
import { parsePathbuilderId } from '../viewer/pathbuilderId.js'
import CritcrafterAbout from './CritcrafterAbout.vue'
import { loadRecent } from '../viewer/recent.js'

const props = defineProps({ badId: { type: Boolean, default: false } })
const emit = defineEmits(['open'])

const input = ref('')
const invalid = ref(props.badId)
const recent = loadRecent()

function submit() {
  const id = parsePathbuilderId(input.value)
  invalid.value = id === null
  if (id) emit('open', id)
}
</script>

<template>
  <div class="cc-landing column justify-center q-pa-lg col" data-testid="cc-landing">
    <div class="text-h5 q-mb-md">CritCrafter</div>
    <q-input
      v-model="input"
      dark
      filled
      autofocus
      label="Pathbuilder id or share link"
      :error="invalid"
      error-message="That is not a Pathbuilder id or link"
      data-testid="cc-id-input"
      @update:model-value="invalid = false"
      @keyup.enter="submit"
    >
      <template #append>
        <q-btn flat round icon="arrow_forward" aria-label="Open character" @click="submit" />
      </template>
    </q-input>
    <div class="text-caption q-mt-sm cc-hint">Paste your Pathbuilder id or share link</div>

    <div v-if="recent.length" class="q-mt-lg" data-testid="cc-recent">
      <div class="cc-label">Recent</div>
      <div class="row q-gutter-sm">
        <q-chip
          v-for="r in recent"
          :key="r.id"
          clickable
          color="dark"
          text-color="white"
          :label="r.name"
          @click="emit('open', r.id)"
        />
      </div>
    </div>
    <CritcrafterAbout />
  </div>
</template>

<style scoped>
.cc-hint {
  color: var(--q-secondary);
}
.cc-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--q-secondary);
  margin-bottom: 4px;
}
</style>
