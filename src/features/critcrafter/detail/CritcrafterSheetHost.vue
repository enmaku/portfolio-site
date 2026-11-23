<script setup>
/**
 * Renders the shared bottom sheet stack (breakdown, then stacked detail). Mount once in the viewer.
 * Open sheets from anywhere via `openBreakdown(target)` / `openDetail(entry)` (./sheetStack.js).
 */
import { computed } from 'vue'
import { sheets } from './sheetStack.js'

const top = sheets.top
const open = computed({
  get: () => top.value !== null,
  set: (v) => {
    if (!v) sheets.close()
  },
})
const AON_LINK = 'Search Archives of Nethys'
</script>

<template>
  <q-dialog v-model="open" position="bottom" data-testid="cc-sheet-host">
    <q-card v-if="top" class="cc-sheet" :data-testid="`cc-sheet-${top.kind}`">
      <q-card-section class="row items-center no-wrap q-pb-none">
        <q-btn
          v-if="sheets.canGoBack.value"
          flat
          round
          dense
          icon="arrow_back"
          aria-label="Back"
          data-testid="cc-sheet-back"
          @click="sheets.back()"
        />
        <div class="text-h6 col ellipsis q-ml-xs">{{ top.view.title }}</div>
        <div v-if="top.kind === 'breakdown'" class="text-h4" data-testid="cc-sheet-total">{{ top.view.total }}</div>
      </q-card-section>

      <q-card-section v-if="top.kind === 'breakdown'">
        <div v-for="(r, i) in top.view.rows" :key="i" class="cc-row row items-center no-wrap" data-testid="cc-sheet-row">
          <div class="col ellipsis">{{ r.label }}</div>
          <q-chip v-if="r.chip" dense square dark class="cc-chip text-caption">{{ r.chip }}</q-chip>
          <div class="cc-amt text-right">{{ r.amount }}</div>
        </div>
        <div class="cc-row cc-total row items-center no-wrap text-weight-bold">
          <div class="col">Total</div>
          <div class="cc-amt text-right">{{ top.view.total }}</div>
        </div>
        <div v-if="top.view.actions.length" class="q-mt-md">
          <div
            v-for="a in top.view.actions"
            :key="a.key"
            class="cc-row cc-tap row items-center no-wrap"
            data-testid="cc-sheet-action"
            @click="sheets.openDetail(a)"
          >
            <div class="col ellipsis">{{ a.name }}</div>
            <q-icon name="chevron_right" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-else>
        <div v-if="top.view.traits.length" class="q-mb-sm">
          <q-chip v-for="t in top.view.traits" :key="t" dense square dark class="cc-chip text-caption">{{ t }}</q-chip>
        </div>
        <div v-if="top.view.bulk != null || top.view.price" class="text-caption q-mb-sm" data-testid="cc-detail-meta">
          <span v-if="top.view.bulk != null">Bulk {{ top.view.bulk }}</span>
          <span v-if="top.view.bulk != null && top.view.price"> · </span>
          <span v-if="top.view.price">{{ top.view.price }}</span>
        </div>
        <div v-if="top.view.facts.length" class="text-caption q-mb-sm" data-testid="cc-detail-facts">
          <div v-for="f in top.view.facts" :key="f.label"><span class="text-weight-bold">{{ f.label }}</span> {{ f.value }}</div>
        </div>
        <!-- html is sanitised by the sheet function (schema invariant 4) -->
        <div v-if="top.view.html" class="cc-rules" data-testid="cc-detail-rules" v-html="top.view.html" />
        <div v-if="top.view.html" class="text-caption text-grey-5 q-mt-sm">
          {{ top.view.licenseTag }}<span v-if="top.view.source"> · {{ top.view.source }}</span>
        </div>
        <a
          v-else-if="top.view.aonUrl"
          :href="top.view.aonUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="cc-aon"
          data-testid="cc-detail-aon"
        >{{ AON_LINK }}</a>
        <div v-for="l in top.view.linked" :key="l.name" class="q-mt-md">
          <div class="text-weight-bold">{{ l.name }} <span class="text-caption">rank {{ l.rank }}</span></div>
          <div v-if="l.rules" class="cc-rules" v-html="l.rules.html" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.cc-sheet {
  width: 100%;
  background: #3d484d;
  color: rgba(255, 255, 255, 0.87);
  border-radius: 16px 16px 0 0;
  min-height: 30vh;
  max-height: 85vh;
  overflow: auto;
}
.cc-row {
  min-height: 48px;
  font-size: 16px;
  border-bottom: 1px solid rgba(142, 141, 139, 0.3);
}
.cc-tap {
  cursor: pointer;
}
.cc-total {
  border-bottom: 0;
}
.cc-amt {
  min-width: 48px;
}
.cc-chip {
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.7);
}
.cc-aon {
  color: inherit;
  text-decoration: underline;
}
.cc-rules :deep(p) {
  margin: 0 0 8px;
}
</style>
