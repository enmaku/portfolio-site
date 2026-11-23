<script setup>
/** A tappable derived number: dotted underline cue, 48px minimum hit area. Emits `tap`. */
defineProps({ text: { type: String, required: true } })
defineEmits(['tap'])
</script>

<template>
  <button type="button" class="cc-tap" data-testid="cc-tap" @click.stop="$emit('tap')">
    <span class="cc-tap__text">{{ text }}</span>
  </button>
</template>

<style scoped>
.cc-tap {
  min-width: 48px;
  min-height: 48px;
  padding: 0 4px;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: right;
}
.cc-tap__text {
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}
</style>
