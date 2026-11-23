<script setup>
defineProps({
  /** A LoadFailure from viewer/loadSheet.js. */
  failure: { type: Object, required: true },
})
defineEmits(['retry', 'try-another'])
</script>

<template>
  <div
    class="column items-center justify-center text-center q-pa-lg col"
    :data-testid="`cc-failure-${failure.state}`"
    role="alert"
  >
    <q-icon name="error_outline" size="48px" color="secondary" />
    <div class="text-body1 q-my-md">{{ failure.message }}</div>
    <q-btn v-if="failure.retry" unelevated no-caps color="primary" label="Retry" @click="$emit('retry')" />
    <q-btn
      v-if="failure.tryAnother"
      unelevated
      no-caps
      color="primary"
      label="Try another id"
      @click="$emit('try-another')"
    />
  </div>
</template>
