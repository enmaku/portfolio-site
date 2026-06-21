<template>
  <q-page class="world-builder-page column">
    <div class="row items-center q-gutter-md q-pa-sm controls-row">
      <q-input
        v-model="seedInput"
        data-testid="world-builder-seed-input"
        type="number"
        dense
        outlined
        label="Geography seed"
        class="seed-input"
        min="0"
        :disable="isGenerating"
        @update:model-value="onSeedInputChange"
      />
      <div class="col-grow wind-slider">
        <div class="text-caption q-mb-xs">Prevailing wind: {{ prevailingWindDegrees }}°</div>
        <q-slider
          v-model="prevailingWindDegrees"
          data-testid="world-builder-wind-slider"
          :min="0"
          :max="359"
          :step="1"
          label
          color="primary"
          :disable="isGenerating"
        />
      </div>
      <q-btn
        data-testid="world-builder-regenerate"
        color="primary"
        label="Regenerate"
        :loading="isGenerating"
        :disable="isGenerating"
        @click="regenerate"
      />
      <q-btn
        data-testid="world-builder-generation-replay"
        flat
        color="primary"
        label="Replay erosion"
        :disable="!canReplay || isGenerating"
        @click="replayErosion"
      />
      <q-btn
        flat
        round
        dense
        icon="assessment"
        aria-label="Toggle generation report"
        @click="reportDrawerOpen = !reportDrawerOpen"
      />
    </div>
    <div
      v-if="isGenerating || generationProgress.completedStepIndex >= 0"
      data-testid="world-builder-generation-progress"
      class="q-px-sm q-pb-sm generation-progress"
    >
      <q-linear-progress
        :value="generationProgress.percent / 100"
        color="primary"
        track-color="grey-9"
        rounded
      />
      <div class="row q-gutter-xs q-mt-xs generation-step-row">
        <q-chip
          v-for="step in generationStepStatuses"
          :key="step.id"
          dense
          :data-testid="`world-builder-generation-step-${step.id}`"
          :color="stepStatusColor(step.status)"
          text-color="white"
          :outline="step.status === 'pending'"
        >
          {{ step.label }}
        </q-chip>
      </div>
    </div>
    <div class="row col map-row">
      <div
        ref="mapHostRef"
        data-testid="world-builder-map-host"
        class="map-host col"
      />
      <aside
        v-show="reportDrawerOpen"
        data-testid="world-builder-generation-report"
        class="generation-report-panel column bg-grey-10"
      >
        <div class="q-pa-md col scroll">
          <div class="text-subtitle2 q-mb-sm">Generation report</div>
          <div class="text-caption q-mb-md">
            Erosion steps: {{ stageSummary.erosionStepCount }} · Navigable rivers:
            {{ stageSummary.navigableRiverEdgeCount }} · Coastal nodes:
            {{ stageSummary.coastalNodeCount }}
          </div>
          <q-list bordered separator>
            <q-item
              v-for="row in validationRows"
              :key="row.checkId"
              :data-testid="`world-builder-validation-row-${row.checkId}`"
              clickable
              @click="onValidationRowClick(row)"
            >
              <q-item-section avatar>
                <q-icon
                  :name="validationStatusIcon(row.status)"
                  :color="validationStatusColor(row.status)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ row.checkId }}</q-item-label>
                <q-item-label caption>{{ row.summary }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </aside>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  DERIVED_GEOGRAPHY_STEPS,
  runDerivedGeographyInWorker,
} from '@world-builder/runDerivedGeographyInWorker.js'
import {
  createControlsStateForSeed,
  createGenerationStepStatuses,
  createRandomGeographySeed,
  createStageSummaryForDisplay,
  createValidationRowsForDisplay,
  generationProgressValue,
  normalizeWindDegrees,
  parseGeographySeedInput,
  validationStatusColor,
  validationStatusIcon,
} from '@world-builder/worldBuilderPageModel.js'

const mapHostRef = ref(null)
const seedInput = ref('0')
const prevailingWindDegrees = ref(0)
const reportDrawerOpen = ref(true)
const isGenerating = ref(false)

/** @type {import('vue').Ref<import('@world-builder/core/types.js').WorldDocument | null>} */
const worldDocument = ref(null)

/** @type {import('vue').Ref<{ percent: number, activeStepIndex: number, completedStepIndex: number, label: string }>} */
const generationProgress = ref({
  percent: 0,
  activeStepIndex: -1,
  completedStepIndex: -1,
  label: '',
})

/** @type {{ updateWorldDocument: Function, focusOn: Function, playErosionSnapshots: Function, destroy: Function } | null} */
let mapViewport = null

/** @type {typeof import('@world-builder/renderer/createWorldBuilderMapViewport.js').createWorldBuilderMapViewport | null} */
let createWorldBuilderMapViewport = null

/** @type {{ cancel: () => void } | null} */
let activeGenerationJob = null

const validationRows = computed(() =>
  createValidationRowsForDisplay(worldDocument.value?.generationReport),
)
const stageSummary = computed(() =>
  createStageSummaryForDisplay(worldDocument.value?.generationReport),
)
const canReplay = computed(() => (worldDocument.value?.erosionSnapshots?.length ?? 0) > 0)
const generationStepStatuses = computed(() =>
  createGenerationStepStatuses(
    DERIVED_GEOGRAPHY_STEPS,
    generationProgress.value.activeStepIndex,
    generationProgress.value.completedStepIndex,
  ),
)

/**
 * @param {'pending' | 'active' | 'complete'} status
 */
function stepStatusColor(status) {
  if (status === 'complete') return 'positive'
  if (status === 'active') return 'primary'
  return 'grey-8'
}

function resetGenerationProgress() {
  generationProgress.value = {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: '',
  }
}

/**
 * @param {import('@world-builder/core/types.js').WorldDocument} doc
 */
async function applyWorldDocumentToMap(doc) {
  worldDocument.value = doc

  if (mapViewport) {
    mapViewport.updateWorldDocument(doc)
    return
  }

  if (mapHostRef.value && createWorldBuilderMapViewport) {
    mapViewport = await createWorldBuilderMapViewport(mapHostRef.value, doc)
  }
}

function regenerate() {
  const parsedSeed = parseGeographySeedInput(seedInput.value)
  if (parsedSeed === null) {
    return
  }

  activeGenerationJob?.cancel()
  activeGenerationJob = null
  isGenerating.value = true
  resetGenerationProgress()

  activeGenerationJob = runDerivedGeographyInWorker(
    {
      geographySeed: parsedSeed,
      prevailingWindDegrees: normalizeWindDegrees(prevailingWindDegrees.value),
    },
    {
      onStepStart({ stepIndex, stepCount, label }) {
        generationProgress.value = {
          percent: generationProgressValue(stepIndex, stepCount),
          activeStepIndex: stepIndex,
          completedStepIndex: generationProgress.value.completedStepIndex,
          label,
        }
      },
      onStepComplete({ stepIndex, stepCount, label, worldDocument: doc }) {
        generationProgress.value = {
          percent: generationProgressValue(stepIndex, stepCount),
          activeStepIndex: stepIndex,
          completedStepIndex: stepIndex,
          label,
        }
        applyWorldDocumentToMap(doc)
      },
      onComplete() {
        isGenerating.value = false
        activeGenerationJob = null
        generationProgress.value = {
          ...generationProgress.value,
          percent: 100,
          activeStepIndex: -1,
        }
      },
      onCancelled() {
        isGenerating.value = false
        activeGenerationJob = null
      },
      onError() {
        isGenerating.value = false
        activeGenerationJob = null
      },
    },
  )
}

function replayErosion() {
  if (!mapViewport || !worldDocument.value?.erosionSnapshots?.length) return
  mapViewport.playErosionSnapshots(worldDocument.value.erosionSnapshots, worldDocument.value)
}

/**
 * @param {{ mapFocus?: import('@world-builder/core/types.js').MapFocus }} row
 */
function onValidationRowClick(row) {
  if (!row.mapFocus || !mapViewport) return
  mapViewport.focusOn(row.mapFocus)
}

function onSeedInputChange() {
  const parsedSeed = parseGeographySeedInput(seedInput.value)
  if (parsedSeed === null) {
    return
  }
  prevailingWindDegrees.value = createControlsStateForSeed(parsedSeed).prevailingWindDegrees
}

onMounted(async () => {
  const initial = createControlsStateForSeed(createRandomGeographySeed())
  seedInput.value = String(initial.geographySeed)
  prevailingWindDegrees.value = initial.prevailingWindDegrees

  const rendererModule = await import('@world-builder/renderer/createWorldBuilderMapViewport.js')
  createWorldBuilderMapViewport = rendererModule.createWorldBuilderMapViewport
  regenerate()
})

onUnmounted(() => {
  activeGenerationJob?.cancel()
  activeGenerationJob = null
  mapViewport?.destroy()
  mapViewport = null
})
</script>

<style scoped>
.world-builder-page {
  height: calc(100vh - 50px);
  min-height: 320px;
}

.controls-row {
  flex: 0 0 auto;
}

.seed-input {
  width: 180px;
}

.wind-slider {
  min-width: 180px;
}

.generation-progress {
  flex: 0 0 auto;
}

.generation-step-row {
  overflow-x: auto;
}

.map-row {
  min-height: 0;
  overflow: hidden;
}

.map-host {
  min-height: 0;
  overflow: hidden;
}

.generation-report-panel {
  flex: 0 0 320px;
  width: 320px;
  min-height: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  overflow-y: auto;
}
</style>
