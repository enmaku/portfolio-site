<script setup>
/** Skills: one column, U T E M L ladder with the current rank circled, aligned right-aligned tappable bonus. */
import { ref } from 'vue'
import CritcrafterStatSheet from '../components/CritcrafterStatSheet.vue'
import CritcrafterTapStat from '../components/CritcrafterTapStat.vue'
import { rankLadder, signed } from '../viewer/screenModel.js'

defineProps({ sheet: { type: Object, required: true } })

const sheetOpen = ref(false)
const picked = ref(null)
function show(skill) {
  picked.value = skill
  sheetOpen.value = true
}
</script>

<template>
  <div class="q-pt-md" data-testid="cc-screen-skills">
    <div v-if="sheet.skills.length === 0" class="text-body2 cc-muted" data-testid="cc-empty">No skills in this build</div>
    <div v-for="s in sheet.skills" :key="s.key" class="cc-skill row items-center no-wrap" data-testid="cc-skill">
      <div class="col ellipsis cc-skill__name">{{ s.name }}</div>
      <span class="cc-ladder">
        <span v-for="r in rankLadder(s.rank)" :key="r.rank" class="cc-ladder__pip" :class="{ 'cc-ladder__pip--on': r.current }">{{ r.rank }}</span>
      </span>
      <CritcrafterTapStat class="cc-skill__bonus" :text="signed(s.bonus.value)" @tap="show(s)" />
    </div>
    <CritcrafterStatSheet v-model="sheetOpen" :title="picked?.name || ''" :stat="picked?.bonus || null" />
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
.cc-skill {
  min-height: 52px;
}
.cc-skill__name {
  font-size: 16px;
}
.cc-ladder {
  display: inline-flex;
  flex: none;
}
.cc-ladder__pip {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--q-secondary);
  opacity: 0.6;
}
.cc-ladder__pip--on {
  background: var(--q-primary);
  color: #fff;
  opacity: 1;
}
.cc-skill__bonus {
  width: 56px;
  flex: none;
  font-size: 16px;
}
</style>
