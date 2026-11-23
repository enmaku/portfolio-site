<script setup>
/** Stats: Rest row, then Saves, Abilities, DC & attack as card grids in ruled sections, then a collapsed Features expansion. */
import { computed } from 'vue'
import StatNumber from '../detail/StatNumber.vue'
import { openDetail } from '../detail/sheetStack.js'
import { statsScreenView } from '../detail/statsModel.js'
import { featureGroups } from '../detail/featuresModel.js'
import CritcrafterRests from '../components/CritcrafterRests.vue'

const props = defineProps({ sheet: { type: Object, required: true } })
const view = computed(() => statsScreenView(props.sheet))
const groups = computed(() => featureGroups(props.sheet.features))
</script>

<template>
  <div class="cc-stats" data-testid="cc-stats">
    <CritcrafterRests />
    <q-separator dark class="cc-sep" />

    <div class="cc-label">Saves</div>
    <div class="row q-col-gutter-sm">
      <div v-for="s in view.saves" :key="s.id" class="col-4" data-testid="cc-save">
        <div class="cc-card text-center"><div class="text-caption">{{ s.label }}</div><div class="text-h6"><StatNumber :target="s" class="cc-statcard" /></div></div>
      </div>
    </div>

    <q-separator dark class="cc-sep" />
    <div class="cc-label">Abilities</div>
    <div class="row q-col-gutter-sm">
      <div v-for="a in view.abilities" :key="a.id" class="col-4" data-testid="cc-ability">
        <div class="cc-card text-center"><div class="text-caption">{{ a.label }}</div><div class="text-h6">{{ a.mod }}</div></div>
      </div>
    </div>

    <q-separator dark class="cc-sep" />
    <div class="cc-label">DC &amp; attack</div>
    <div class="row q-col-gutter-sm">
      <div v-for="d in view.dc" :key="d.label" class="col-4" data-testid="cc-dc">
        <div class="cc-card text-center"><div class="text-caption">{{ d.label }}</div><div class="text-h6"><StatNumber :target="d" class="cc-statcard" /></div></div>
      </div>
    </div>

    <template v-if="groups.length">
      <q-separator dark class="cc-sep" />
      <q-expansion-item dark expand-separator label="Features" class="cc-exp" header-class="cc-exp-head" data-testid="cc-features">
        <div v-for="g in groups" :key="g.id" class="q-mb-sm">
          <div class="cc-label q-mt-sm">{{ g.label }}</div>
          <div
            v-for="r in g.rows"
            :key="r.key"
            class="cc-card cc-card--tap q-mb-xs row items-center no-wrap"
            data-testid="cc-feature"
            @click="openDetail(r.entry)"
          >
            <div class="col ellipsis">{{ r.title }}</div>
            <div v-if="r.levelLabel" class="text-caption text-grey-5 q-mr-sm">Lv {{ r.levelLabel }}</div>
            <q-icon v-if="!r.entry.rules" name="open_in_new" size="16px" />
          </div>
        </div>
      </q-expansion-item>
    </template>
  </div>
</template>

<style scoped>
.cc-statcard {
  min-height: 0;
}
</style>
