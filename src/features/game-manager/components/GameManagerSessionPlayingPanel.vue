<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-session-playing">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ session?.game?.title || 'Playing' }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-session-playing-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col flex flex-center q-pt-none">
      <div class="text-center text-grey-5" data-testid="gm-session-playing-interstitial">
        <q-icon name="timer" size="48px" class="q-mb-md" />
        <div class="text-h6">Game timer goes here</div>
      </div>
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md">
      <q-btn
        class="full-width"
        unelevated
        color="primary"
        label="Finish game"
        data-testid="gm-session-playing-finish"
        :loading="busy"
        :disable="busy"
        @click="$emit('finish-game')"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
defineProps({
  session: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

defineEmits(['close', 'finish-game'])
</script>
