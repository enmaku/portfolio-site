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
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MonsterCardFace from '../../components/dungeon-runner/MonsterCardFace.vue'
import {
  MONSTER_CARD_SPECS,
  monsterCardSpecByStrength,
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
