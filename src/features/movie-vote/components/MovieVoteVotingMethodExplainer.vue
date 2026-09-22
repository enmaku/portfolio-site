<template>
  <div
    v-if="activeEntry"
    class="mv-voting-method-explainer row items-center no-wrap q-px-md q-pt-sm q-pb-xs"
    data-testid="mv-voting-method-explainer"
  >
    <div class="col text-subtitle2 text-weight-medium ellipsis">{{ activeEntry.label }}</div>
    <q-btn
      flat
      round
      dense
      type="button"
      icon="info_outline"
      color="grey-6"
      class="col-auto"
      aria-label="About this voting method"
      data-testid="mv-voting-method-explainer-info"
      @click="helpOpen = true"
    />
    <q-dialog v-model="helpOpen">
      <q-card
        class="mv-voting-method-explainer-dialog column no-wrap"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`mv-voting-method-explainer-${activeEntry.method}-title`"
      >
        <q-card-section class="q-pb-sm">
          <div
            :id="`mv-voting-method-explainer-${activeEntry.method}-title`"
            class="text-h6"
          >
            {{ activeEntry.label }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section class="q-px-md">
          <p class="text-body2 q-my-none q-mb-xs">{{ activeEntry.chooseThis }}</p>
          <p class="text-body2 text-grey-7 q-my-none q-mb-xs">{{ activeEntry.howItWorks }}</p>
          <a
            :href="activeEntry.wikipediaUrl"
            class="text-body2 text-primary"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${activeEntry.label} on Wikipedia (opens in new tab)`"
          >
            Wikipedia
            <q-icon name="open_in_new" size="xs" class="q-ml-xs" aria-hidden="true" />
          </a>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { getVotingMethodHelpEntries } from '../votingMethodHelp.js'

const store = useMovieVoteStore()
const { votingMethod } = storeToRefs(store)
const helpOpen = ref(false)

const entries = getVotingMethodHelpEntries()

const activeEntry = computed(() => entries.find((e) => e.method === votingMethod.value) ?? null)
</script>

<style scoped>
.mv-voting-method-explainer {
  flex-shrink: 0;
}

.mv-voting-method-explainer-dialog {
  width: min(400px, 100vw - 32px);
}
</style>
