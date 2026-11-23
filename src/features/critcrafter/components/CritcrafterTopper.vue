<script setup>
/** Pinned topper: identity and the headline numbers. Slot `extra` sits under them (shield row etc.). */
import { computed } from 'vue'
import StatNumber from '../detail/StatNumber.vue'
import { topperTargets } from '../detail/statsModel.js'

const props = defineProps({
  sheet: { type: Object, required: true },
  /** Live table state (store), all optional: current HP, temp HP, and live AC as a Stat. */
  hp: { type: Number, default: null },
  tempHp: { type: Number, default: 0 },
  acStat: { type: Object, default: null },
})
defineEmits(['open-hp'])
const t = computed(() => {
  const targets = topperTargets(props.sheet)
  if (props.acStat) targets.ac = { ...targets.ac, stat: props.acStat }
  return targets
})
</script>

<template>
  <div class="cc-hero q-pa-md q-ma-sm" data-testid="cc-topper">
    <div class="row items-baseline no-wrap">
      <div class="text-h6 col ellipsis">{{ sheet.header.name }}</div>
      <div class="text-caption q-ml-sm">Lv {{ sheet.header.level }}</div>
    </div>
    <div class="text-caption cc-line">
      {{ sheet.header.ancestry }} · {{ sheet.header.classLine }}
    </div>
    <div class="row q-mt-sm text-center">
      <div class="col cc-hp" role="button" tabindex="0" @click="$emit('open-hp')" @keydown.enter="$emit('open-hp')">
        <div class="text-h5" data-testid="cc-hp">
          <template v-if="hp !== null">{{ hp }} / </template>
          <StatNumber :target="t.hp">{{ sheet.header.hp.value }}</StatNumber><template v-if="tempHp"> +{{ tempHp }}</template>
        </div>
        <div class="text-caption">HP</div>
      </div>
      <div class="col">
        <div class="text-h5" data-testid="cc-ac"><StatNumber :target="t.ac" /></div>
        <div class="text-caption">AC</div>
      </div>
      <div class="col">
        <div class="text-h5"><StatNumber :target="t.perception" /></div>
        <div class="text-caption">Perception</div>
      </div>
      <div class="col">
        <div class="text-h5"><StatNumber :target="t.speed" /></div>
        <div class="text-caption">Speed</div>
      </div>
    </div>
    <slot name="extra" />
  </div>
</template>

<style scoped>
.cc-hero {
  background: var(--q-primary);
  border-radius: 12px;
  flex: none;
}
.cc-hp {
  cursor: pointer;
  min-height: 48px;
}
.cc-line {
  opacity: 0.8;
}
</style>
