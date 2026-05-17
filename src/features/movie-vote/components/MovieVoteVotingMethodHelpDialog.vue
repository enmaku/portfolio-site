<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card
      class="mv-voting-method-help-card column no-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mv-voting-method-help-title"
    >
      <q-card-section class="q-pb-sm">
        <div id="mv-voting-method-help-title" class="text-h6">Voting methods</div>
      </q-card-section>
      <q-separator />
      <q-card-section
        class="mv-voting-method-help-card__body col scroll q-px-md"
        role="region"
        aria-label="Voting method reference"
        tabindex="0"
      >
        <article
          v-for="entry in entries"
          :key="entry.method"
          class="mv-voting-method-help-entry q-mb-md"
          :aria-labelledby="`mv-voting-method-help-${entry.method}-title`"
        >
          <h3
            :id="`mv-voting-method-help-${entry.method}-title`"
            class="text-subtitle2 text-weight-medium q-my-none q-mb-xs"
          >
            {{ entry.label }}
          </h3>
          <p class="text-body2 q-my-none q-mb-xs">{{ entry.chooseThis }}</p>
          <a
            :href="entry.wikipediaUrl"
            class="text-body2 text-primary"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${entry.label} on Wikipedia (opens in new tab)`"
          >
            Wikipedia
            <q-icon name="open_in_new" size="xs" class="q-ml-xs" aria-hidden="true" />
          </a>
        </article>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { getVotingMethodHelpEntries } from '../votingMethodHelp.js'

defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const entries = getVotingMethodHelpEntries()
</script>

<style scoped>
.mv-voting-method-help-card {
  width: min(400px, 100vw - 32px);
  max-height: min(85vh, 640px);
}

.mv-voting-method-help-card__body {
  max-height: min(70vh, 520px);
}

.mv-voting-method-help-entry:last-child {
  margin-bottom: 0;
}
</style>
