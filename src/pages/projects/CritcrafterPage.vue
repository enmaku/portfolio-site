<script setup>
/**
 * CritCrafter character viewer page (/projects/critcrafter?id=<digits>). Thin: route state and
 * switching between landing, loading, failure and the loaded viewer. Behaviour lives in
 * src/features/critcrafter/viewer/.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CritcrafterLanding from '../../features/critcrafter/components/CritcrafterLanding.vue'
import CritcrafterLoading from '../../features/critcrafter/components/CritcrafterLoading.vue'
import CritcrafterFailure from '../../features/critcrafter/components/CritcrafterFailure.vue'
import CritcrafterViewer from '../../features/critcrafter/components/CritcrafterViewer.vue'
import { parsePathbuilderId } from '../../features/critcrafter/viewer/pathbuilderId.js'
import { useSheetLoader } from '../../features/critcrafter/viewer/useSheetLoader.js'

const route = useRoute()
const router = useRouter()
const { phase, step, sheet, failure, load, reset } = useSheetLoader()

const urlId = computed(() => parsePathbuilderId(route.query.id))
const badUrlId = computed(() => route.query.id != null && urlId.value === null)
const lastId = ref(null)

watch(
  urlId,
  (id) => {
    lastId.value = id
    if (id) load(id)
    else reset()
  },
  { immediate: true },
)

/** Landing submit / Recent chip: normalised id goes into the URL, which triggers the load. */
function openId(id) {
  router.push({ path: route.path, query: { id } })
}

function tryAnother() {
  router.push({ path: route.path })
}

function retry() {
  if (lastId.value) load(lastId.value)
}
</script>

<template>
  <q-page class="cc-page column no-wrap">
    <CritcrafterLoading v-if="phase === 'loading'" :step="step" />
    <CritcrafterFailure
      v-else-if="phase === 'error'"
      :failure="failure"
      @retry="retry"
      @try-another="tryAnother"
    />
    <CritcrafterViewer v-else-if="phase === 'ready'" :sheet="sheet" />
    <CritcrafterLanding v-else :bad-id="badUrlId" @open="openId" />
  </q-page>
</template>

<style scoped>
.cc-page {
  height: 100dvh;
  background: var(--q-dark-page);
  color: rgba(255, 255, 255, 0.87);
}
</style>
