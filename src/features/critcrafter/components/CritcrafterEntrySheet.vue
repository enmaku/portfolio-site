<script setup>
/**
 * Item detail bottom sheet (minimal local version; #502 may land a shared one). Shows rules text, bulk,
 * price and licence tag. A corpus miss (rules null) shows the name plus an AoN link. Scroll/wand `linked[]`
 * spells render as their own sections.
 */
import { computed } from 'vue'
import CritcrafterCostGlyph from './CritcrafterCostGlyph.vue'
import CritcrafterTraitChips from './CritcrafterTraitChips.vue'

const props = defineProps({ modelValue: { type: Boolean, default: false }, entry: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const aon = computed(() => props.entry?.aonUrl || '')
</script>

<template>
  <q-dialog v-model="open" position="bottom" data-testid="cc-entry-sheet">
    <q-card v-if="entry" class="cc-sheet">
      <q-card-section>
        <div class="row items-center no-wrap">
          <div class="text-h6 col">{{ entry.name }}</div>
          <CritcrafterCostGlyph :cost="entry.cost" />
        </div>
        <CritcrafterTraitChips :traits="entry.traits" />
        <div v-if="entry.bulk != null || entry.price" class="text-caption cc-muted q-mt-sm">
          <span v-if="entry.bulk != null">Bulk {{ entry.bulk }}</span>
          <span v-if="entry.bulk != null && entry.price"> · </span>
          <span v-if="entry.price">{{ entry.price }}</span>
        </div>
      </q-card-section>
      <q-card-section v-if="entry.rules" class="q-pt-none">
        <!-- eslint-disable-next-line vue/no-v-html -- html comes from our own rules corpus -->
        <div class="cc-rules" v-html="entry.rules.html" />
        <div class="text-caption cc-muted q-mt-sm" data-testid="cc-licence">{{ entry.rules.license }} · {{ entry.rules.source }}</div>
      </q-card-section>
      <q-card-section v-else class="q-pt-none" data-testid="cc-rules-miss">
        <a v-if="aon" :href="aon" target="_blank" rel="noopener">Look up {{ entry.name }} on Archives of Nethys</a>
        <div v-else class="cc-muted">No rules text available.</div>
      </q-card-section>
      <q-card-section v-for="l in entry.linked || []" :key="l.name" class="q-pt-none" data-testid="cc-linked">
        <div class="row items-center no-wrap">
          <div class="text-subtitle1 col">{{ l.name }} <span class="cc-muted">· Rank {{ l.rank }}</span></div>
          <CritcrafterCostGlyph :cost="l.cost" />
        </div>
        <CritcrafterTraitChips :traits="l.traits" />
        <!-- eslint-disable-next-line vue/no-v-html -- html comes from our own rules corpus -->
        <div v-if="l.rules" class="cc-rules q-mt-sm" v-html="l.rules.html" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.cc-sheet {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: auto;
}
.cc-muted {
  color: var(--q-secondary);
}
.cc-rules :deep(p) {
  margin: 0 0 8px;
}
</style>
