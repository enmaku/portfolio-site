<script setup>
/** Placeholder body for a screen that a later ticket builds out. */
defineProps({ title: { type: String, required: true }, detail: { type: String, default: '' } })
</script>

<template>
  <div class="q-pt-lg" :data-testid="`cc-screen-${title.toLowerCase()}`">
    <div class="cc-label">{{ title }}</div>
    <div class="text-body2 cc-muted">{{ detail || 'Coming soon' }}</div>
  </div>
</template>

<style scoped>
.cc-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--q-secondary);
  margin-bottom: 4px;
}
.cc-muted {
  color: var(--q-secondary);
}
</style>
