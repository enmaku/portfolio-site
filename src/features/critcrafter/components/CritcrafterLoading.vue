<script setup>
import { computed } from 'vue'

const props = defineProps({ step: { type: String, default: 'fetching' } })
const status = computed(() =>
  props.step === 'building' ? 'Building your sheet…' : 'Fetching from Pathbuilder…',
)
</script>

<template>
  <div class="cc-loading column no-wrap col" data-testid="cc-loading" aria-busy="true">
    <div class="cc-topper-skel q-ma-sm q-pa-md">
      <q-skeleton dark type="text" width="55%" height="28px" />
      <q-skeleton dark type="text" width="40%" />
      <div class="row q-col-gutter-sm q-mt-sm">
        <div v-for="n in 4" :key="n" class="col-3"><q-skeleton dark type="rect" height="44px" /></div>
      </div>
    </div>
    <div class="q-px-md col">
      <div v-for="n in 3" :key="n" class="cc-skel-section q-mt-lg">
        <q-skeleton dark type="text" width="25%" height="12px" />
        <q-skeleton dark type="rect" height="56px" class="q-mt-sm" />
        <q-skeleton dark type="rect" height="56px" class="q-mt-sm" />
      </div>
    </div>
    <div class="cc-status text-center q-pa-md" role="status" data-testid="cc-status">{{ status }}</div>
  </div>
</template>

<style scoped>
.cc-topper-skel {
  background: var(--q-primary);
  border-radius: 12px;
  flex: none;
}
.cc-skel-section {
  border-top: 1px solid rgba(142, 141, 139, 0.3);
  padding-top: 16px;
}
.cc-status {
  color: var(--q-secondary);
}
</style>
