<script setup>
/** Skills: one column of cards, U T E M L ladder with the current rank circled, aligned right-aligned tappable bonus. */
import CritcrafterRankPips from '../components/CritcrafterRankPips.vue'
import StatNumber from '../detail/StatNumber.vue'

defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <div data-testid="cc-screen-skills">
    <div v-if="sheet.skills.length === 0" class="text-body2 cc-muted" data-testid="cc-empty">No skills in this build</div>
    <div v-for="s in sheet.skills" :key="s.key" class="cc-card q-mb-xs row no-wrap items-center" data-testid="cc-skill">
      <span class="col ellipsis">{{ s.name }}</span>
      <CritcrafterRankPips :rank="s.rank" />
      <StatNumber class="cc-bonus cc-skill__bonus" :target="{ label: s.name, stat: s.bonus }" />
    </div>
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
.cc-skill__bonus {
  min-height: 0;
  font-weight: 700;
  text-align: right;
}
</style>
