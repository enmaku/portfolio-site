<script setup>
defineProps({
  modelValue: { type: String, required: true },
  /** [{ key, label, icon }] from viewerModel.visibleTabs. */
  tabs: { type: Array, required: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <nav class="cc-bar row no-wrap" data-testid="cc-bar">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="cc-tab col column items-center justify-center"
      :class="{ active: modelValue === t.key }"
      :data-testid="`cc-tab-${t.key}`"
      :aria-current="modelValue === t.key ? 'page' : undefined"
      @click="$emit('update:modelValue', t.key)"
    >
      <q-icon :name="t.icon" size="24px" />
      <span>{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.cc-bar {
  background: var(--q-dark);
  height: 64px;
  flex: none;
  margin: 0 8px 8px;
  border-radius: 18px;
  border: 1px solid rgba(142, 141, 139, 0.3);
}
.cc-tab {
  background: none;
  border: 0;
  color: var(--q-secondary);
  font-size: 11px;
  min-height: 48px;
}
.cc-tab.active {
  color: #fff;
}
.cc-tab.active .q-icon {
  background: var(--q-primary);
  border-radius: 12px;
  padding: 2px 14px;
  box-sizing: content-box;
}
</style>
