<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card
      class="mv-quorum-help-card column no-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mv-quorum-help-title"
    >
      <q-card-section class="q-pb-sm">
        <div id="mv-quorum-help-title" class="text-h6">Quorum</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="mv-quorum-help-card__body col scroll text-body2">
        <p class="q-mt-none q-mb-md">
          Who must finish nominating and vote before the room can move on. Everyone can still suggest
          movies.
        </p>

        <div class="text-subtitle2 q-mb-sm">Controls</div>
        <ul class="mv-quorum-help-list q-mb-md">
          <li>
            <strong>Toggle</strong> — on: must mark ready and cast a ballot. Off: can nominate and
            watch; does not block the room.
          </li>
          <li><strong>Trash</strong> — remove that guest (suggest phase only).</li>
          <li><strong>Clear guests</strong> — remove every guest; you stay as host.</li>
        </ul>

        <div class="text-subtitle2 q-mb-sm">Status icons</div>
        <div class="column q-gutter-y-sm">
          <div v-for="row in statusRows" :key="row.key" class="row items-center no-wrap q-gutter-x-sm">
            <q-icon :name="row.icon" :color="row.color" size="sm" aria-hidden="true" />
            <span>{{ row.blurb }}</span>
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const statusRows = [
  { key: 'no_picks', icon: 'movie_edit', color: 'grey-5', blurb: 'Suggesting — no movies yet' },
  { key: 'has_picks', icon: 'movie_edit', color: 'positive', blurb: 'Suggesting — has movies' },
  { key: 'ready', icon: 'how_to_vote', color: 'positive', blurb: 'Ready to vote' },
  { key: 'not_voted', icon: 'ballot', color: 'grey-5', blurb: 'Voting — hasn’t voted yet' },
  { key: 'voted', icon: 'ballot', color: 'positive', blurb: 'Voting — voted' },
  { key: 'watching', icon: 'visibility', color: 'grey-5', blurb: 'Watching (not a required voter)' },
]
</script>

<style scoped>
.mv-quorum-help-card {
  width: min(400px, 100vw - 32px);
  max-height: min(85vh, 560px);
}

.mv-quorum-help-card__body {
  max-height: min(70vh, 420px);
}

.mv-quorum-help-list {
  margin: 0;
  padding-left: 1.15rem;
}

.mv-quorum-help-list li {
  margin-bottom: 0.45rem;
}

.mv-quorum-help-list li:last-child {
  margin-bottom: 0;
}
</style>
