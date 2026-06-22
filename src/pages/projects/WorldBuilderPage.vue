<template>
  <q-page class="world-builder-page column fit no-wrap">
    <div class="row items-center q-gutter-md q-pa-sm controls-row">
      <q-btn
        flat
        round
        dense
        icon="tune"
        aria-label="Toggle generation controls"
        @click="controlsDrawerOpen = !controlsDrawerOpen"
      />
      <q-space />
      <q-btn
        data-testid="world-builder-regenerate"
        color="primary"
        label="Regenerate"
        :loading="isGenerating"
        @click="regenerate"
      />
      <q-btn
        data-testid="world-builder-generation-replay"
        flat
        color="primary"
        label="Replay erosion"
        :disable="!canReplay"
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
      <aside
        v-show="controlsDrawerOpen"
        data-testid="world-builder-generation-controls"
        class="generation-controls-panel bg-grey-10"
      >
        <div class="panel-scroll q-pa-md">
          <div class="text-subtitle2 q-mb-sm">Generation controls</div>
          <q-input
            v-model="seedInput"
            data-testid="world-builder-seed-input"
            type="number"
            dense
            outlined
            label="Geography seed"
            class="q-mb-md"
            min="0"
            @update:model-value="onSeedInputChange"
          >
            <template #append>
              <q-btn
                round
                dense
                flat
                icon="casino"
                data-testid="world-builder-seed-randomize"
                aria-label="Random geography seed"
                @click="randomizeSeed"
              />
            </template>
          </q-input>
          <q-btn
            flat
            dense
            color="primary"
            class="full-width q-mb-md"
            data-testid="world-builder-reset-defaults"
            aria-label="Reset generation settings to defaults"
            @click="resetToDefaults"
          >
            Reset to defaults
          </q-btn>
          <q-expansion-item
            v-for="section in controlSections"
            :key="section.section"
            :label="section.section"
            default-opened
            dense
            header-class="text-caption text-weight-medium"
          >
            <div
              v-for="control in section.controls"
              :key="control.key"
              class="q-mb-md"
            >
              <div class="text-caption q-mb-xs">
                {{ control.label }}:
                {{ formatControlValue(control.key, controlValue(control.key)) }}
              </div>
              <q-slider
                :model-value="controlValue(control.key)"
                :data-testid="control.testId"
                :min="control.min"
                :max="control.max"
                :step="control.step"
                label
                color="primary"
                @update:model-value="onControlChange(control.key, $event)"
              />
            </div>
          </q-expansion-item>
        </div>
      </aside>
      <div
        ref="mapHostRef"
        data-testid="world-builder-map-host"
        class="map-host col"
      />
      <aside
        v-show="reportDrawerOpen"
        data-testid="world-builder-generation-report"
        class="generation-report-panel bg-grey-10"
      >
        <div class="panel-scroll q-pa-md">
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
import { storeToRefs } from 'pinia'
import {
  DERIVED_GEOGRAPHY_STEPS,
  runDerivedGeographyInWorker,
} from '@world-builder/runDerivedGeographyInWorker.js'
import {
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
  formatGenerationControlValue,
} from '@world-builder/worldBuilderGenerationControls.js'
import {
  buildDerivedGeographyParams,
  createGenerationStepStatuses,
  createRandomGeographySeed,
  createStageSummaryForDisplay,
  createValidationRowsForDisplay,
  generationProgressValue,
  parseGeographySeedInput,
  validationStatusColor,
  validationStatusIcon,
} from '@world-builder/worldBuilderPageModel.js'
import { useWorldBuilderSettingsStore } from '../../stores/worldBuilderSettings.js'

const settingsStore = useWorldBuilderSettingsStore()
const { prevailingWindDegrees, generationOptions } = storeToRefs(settingsStore)

const mapHostRef = ref(null)
const seedInput = ref('0')
const controlsDrawerOpen = ref(true)
const reportDrawerOpen = ref(true)
const isGenerating = ref(false)
const controlSections = WORLD_BUILDER_GENERATION_CONTROL_SECTIONS

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
 * @param {string} key
 */
function controlValue(key) {
  if (key === 'prevailingWindDegrees') {
    return prevailingWindDegrees.value
  }
  return generationOptions.value[key]
}

/**
 * @param {string} key
 * @param {number} value
 */
function onControlChange(key, value) {
  settingsStore.setControl(key, value)
  regenerate()
}

/**
 * @param {string} key
 * @param {number} value
 */
function formatControlValue(key, value) {
  return formatGenerationControlValue(key, value)
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
    buildDerivedGeographyParams(parsedSeed, prevailingWindDegrees.value, generationOptions.value),
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
  settingsStore.applySeed(seedInput.value)
  regenerate()
}

function randomizeSeed() {
  seedInput.value = String(createRandomGeographySeed())
  settingsStore.applySeed(seedInput.value)
  regenerate()
}

function resetToDefaults() {
  settingsStore.resetToDefaults()
  regenerate()
}

onMounted(async () => {
  settingsStore.ensureInitialized()
  seedInput.value = String(settingsStore.geographySeed)

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
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.controls-row {
  flex: 0 0 auto;
}

.generation-progress {
  flex: 0 0 auto;
}

.generation-step-row {
  overflow-x: auto;
}

.map-row {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.map-host {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.map-host :deep(canvas) {
  display: block;
}

.generation-controls-panel,
.generation-report-panel {
  flex: 0 0 auto;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.generation-controls-panel {
  width: 300px;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
}

.generation-report-panel {
  width: 320px;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
}

.panel-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
</style>
