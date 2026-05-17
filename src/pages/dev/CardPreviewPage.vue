<template>
  <q-page class="q-pa-md column items-center">
    <div class="col-shrink q-mb-lg" style="width: 100%; max-width: 560px">
      <div class="text-h6 q-mb-sm">Monster card preview</div>
      <p class="text-body2 text-grey-7 q-mb-xs">
        Use <code>?monster=&lt;strength&gt;</code> — strengths match engine cards:
        <strong>{{ validStrengths.join(', ') }}</strong>.
      </p>
      <p class="text-caption text-grey-6">Example: <code>#/cardpreview?monster=5</code> (Golem)</p>
      <q-banner v-if="!resolvedSpec" class="bg-negative text-white q-mt-md" dense rounded>
        No card for strength {{ strength }} — pick one of {{ validStrengths.join(', ') }}.
      </q-banner>
    </div>
    <MonsterCardFace class="col-shrink" :strength="strength" />
    <div class="col-shrink q-mt-xl" style="width: 100%; max-width: 560px">
      <div class="text-subtitle2 q-mb-sm">Flat template (pack.cards.revealedMonster)</div>
      <p class="text-caption text-grey-6 q-mb-sm">
        Single PNG export for art checks; the composed face above is what bidding uses.
      </p>
      <img class="dr-card-flat-template" :src="revealedMonsterTemplateUrl()" alt="" decoding="async" />
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MonsterCardFace from '../../components/dungeon-runner/MonsterCardFace.vue'
import {
  MONSTER_CARD_SPECS,
  monsterCardSpecByStrength,
  revealedMonsterTemplateUrl,
} from '../../features/dungeon-runner/ui/monsterCardSpec.js'

const route = useRoute()

const validStrengths = MONSTER_CARD_SPECS.map((s) => s.strength)

const strength = computed(() => {
  const raw = route.query.monster
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(n) ? n : 1
})

const resolvedSpec = computed(() => monsterCardSpecByStrength(strength.value))
</script>

<style scoped>
.dr-card-flat-template {
  width: 100%;
  max-width: 480px;
  display: block;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
