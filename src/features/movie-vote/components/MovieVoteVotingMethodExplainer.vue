<template>
  <div
    v-if="activeEntry"
    class="mv-voting-method-explainer q-px-md q-pt-sm q-pb-xs"
    data-testid="mv-voting-method-explainer"
  >
    <div class="text-subtitle2 text-weight-medium q-mb-xs">{{ activeEntry.label }}</div>
    <p class="text-body2 text-grey-7 q-my-none q-mb-sm">{{ activeEntry.chooseThis }}</p>
    <q-expansion-item
      dense
      dense-toggle
      expand-separator
      header-class="mv-voting-method-explainer__expand-header"
      label="How it works"
    >
      <div class="text-body2 text-grey-7 q-pb-sm">{{ activeEntry.howItWorks }}</div>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { getVotingMethodHelpEntries } from '../votingMethodHelp.js'

const store = useMovieVoteStore()
const { votingMethod } = storeToRefs(store)

const entries = getVotingMethodHelpEntries()

const activeEntry = computed(() => entries.find((e) => e.method === votingMethod.value) ?? null)
</script>

<style scoped>
.mv-voting-method-explainer {
  flex-shrink: 0;
}

.mv-voting-method-explainer__expand-header {
  padding-left: 0;
  padding-right: 0;
  min-height: 36px;
}
</style>
