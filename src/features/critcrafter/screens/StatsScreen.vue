<script setup>
/** Stats: Saves, Abilities, DC & attack (ruled sections), then a collapsed Features expansion. */
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
    <div class="cc-label">Saves</div>
    <div v-for="s in view.saves" :key="s.id" class="cc-line row items-center no-wrap" data-testid="cc-save">
      <div class="col">{{ s.label }}</div>
      <div class="text-caption q-mr-sm">{{ s.rank }}</div>
      <StatNumber :target="s" />
    </div>

    <q-separator dark class="cc-sep" />
    <div class="cc-label">Abilities</div>
    <div class="row">
      <div v-for="a in view.abilities" :key="a.id" class="col-4 text-center q-py-sm" data-testid="cc-ability">
        <div class="text-caption">{{ a.label }}</div>
        <div class="text-h6">{{ a.mod }}</div>
        <div class="text-caption">{{ a.score }}</div>
      </div>
    </div>

    <q-separator dark class="cc-sep" />
    <div class="cc-label">DC &amp; attack</div>
    <div v-for="d in view.dc" :key="d.label" class="cc-line row items-center no-wrap" data-testid="cc-dc">
      <div class="col">{{ d.label }}</div>
      <StatNumber :target="d" />
    </div>

    <q-separator dark class="cc-sep" />
    <CritcrafterRests />

    <template v-if="groups.length">
      <q-separator dark class="cc-sep" />
      <q-expansion-item dark expand-separator label="Features" class="cc-feat" data-testid="cc-features">
        <div v-for="g in groups" :key="g.id" class="q-mb-sm">
          <div class="cc-label q-mt-sm">{{ g.label }}</div>
          <div
            v-for="r in g.rows"
            :key="r.key"
            class="cc-line cc-tap row items-center no-wrap"
            data-testid="cc-feature"
            @click="openDetail(r.entry)"
          >
            <div class="col ellipsis">{{ r.title }}</div>
            <div v-if="r.levelLabel" class="text-caption q-mr-sm">Lv {{ r.levelLabel }}</div>
            <q-icon v-if="!r.entry.rules" name="open_in_new" size="16px" />
          </div>
        </div>
      </q-expansion-item>
    </template>
  </div>
</template>

<style scoped>
.cc-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--q-secondary);
  margin-bottom: 4px;
}
.cc-line {
  min-height: 52px;
  font-size: 16px;
}
.cc-tap {
  cursor: pointer;
}
.cc-sep {
  margin: 20px 0 16px;
  background: rgba(142, 141, 139, 0.3);
}
</style>
