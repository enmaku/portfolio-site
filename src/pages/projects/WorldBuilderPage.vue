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
        <template
          v-for="step in generationStepStatuses"
          :key="step.id"
        >
          <q-chip
            dense
            :data-testid="`world-builder-generation-step-${step.id}`"
            :color="stepStatusColor(step.status)"
            text-color="white"
            :outline="step.status === 'pending'"
          >
            {{ step.label }}
          </q-chip>
          <div
            v-if="step.id === 'hydrology' && step.status === 'active'"
            class="row q-gutter-xs items-center hydrology-substep-row"
          >
            <q-chip
              v-for="substep in hydrologySubstepStatuses"
              :key="substep.id"
              dense
              :data-testid="`world-builder-hydrology-substep-${substep.id}`"
              :color="stepStatusColor(substep.status)"
              text-color="white"
              :outline="substep.status === 'pending'"
              size="sm"
            >
              {{ substep.label }}
            </q-chip>
          </div>
        </template>
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
              <q-toggle
                v-if="control.kind === 'toggle'"
                :model-value="Boolean(controlValue(control.key))"
                :data-testid="control.testId"
                color="primary"
                @update:model-value="onControlChange(control.key, $event)"
              />
              <q-slider
                v-else
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
          <div
            class="text-caption q-mb-md"
            data-testid="world-builder-hydrology-stats"
          >
            <div>River cells: {{ hydrologyStats.riverCellCount ?? 'n/a' }}</div>
            <div>Navigable edges: {{ hydrologyStats.navigableEdgeCount ?? 'n/a' }}</div>
            <div>Hack's law exponent: {{ formatHydrologyMetricValue(hydrologyStats.hacksLawExponent) }}</div>
            <div>
              Slope–area concavity:
              {{
                formatSlopeAreaConcavityForDisplay(
                  hydrologyStats.slopeAreaConcavityMedian,
                  hydrologyStats.slopeAreaConcavitySampleCount,
                )
              }}
            </div>
            <div>Parallel strand ratio: {{ formatHydrologyMetricValue(hydrologyStats.parallelStrandRatio) }}</div>
            <div>Navigable km estimate: {{ formatHydrologyMetricValue(hydrologyStats.navigableKmEstimate, 1) }}</div>
            <div>Mouth count: {{ hydrologyStats.mouthCount ?? 'n/a' }}</div>
            <div>Lake count: {{ hydrologyStats.lakeCount ?? 'n/a' }}</div>
            <div>Breach count: {{ hydrologyStats.breachCount ?? 'n/a' }}</div>
            <div>Endorheic fraction: {{ formatHydrologyMetricValue(hydrologyStats.endorheicFraction) }}</div>
            <div>
              Coast-connected navigable path:
              {{ hydrologyStats.coastConnectedNavigablePathLength ?? 'n/a' }} cells
            </div>
            <div data-testid="world-builder-rejection-status">
              Rejected:
              {{ hydrologyStats.shouldReject ? 'yes' : 'no' }}
            </div>
            <div
              v-if="hydrologyStats.rejectionReasons.length > 0"
              data-testid="world-builder-rejection-reasons"
            >
              <div
                v-for="reason in hydrologyStats.rejectionReasons"
                :key="reason"
              >
                {{ reason }}
              </div>
            </div>
          </div>
          <div
            v-if="hydrologySubstepTimings.length > 0"
            class="text-caption q-mb-md"
            data-testid="world-builder-hydrology-substep-timings"
          >
            <div
              v-for="row in hydrologySubstepTimings"
              :key="row.substepId"
              :data-testid="`world-builder-hydrology-timing-${row.substepId}`"
            >
              {{ row.label }}: {{ formatHydrologySubstepTimingForDisplay(row) }}
            </div>
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
  HYDROLOGY_SUBSTEPS,
  runDerivedGeographyInWorker,
} from '@world-builder/runDerivedGeographyInWorker.js'
import {
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
  formatGenerationControlValue,
} from '@world-builder/worldBuilderGenerationControls.js'
import {
  buildDerivedGeographyParams,
  createGenerationStepStatuses,
  createHydrologyStatsForDisplay,
  createHydrologySubstepStatuses,
  createHydrologySubstepTimingsForDisplay,
  formatHydrologySubstepTimingForDisplay,
  createRandomGeographySeed,
  createStageSummaryForDisplay,
  createValidationRowsForDisplay,
  formatHydrologyMetricValue,
  formatSlopeAreaConcavityForDisplay,
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

/** @type {import('vue').Ref<{ percent: number, activeStepIndex: number, completedStepIndex: number, label: string, activeHydrologySubstepIndex: number, completedHydrologySubstepIndex: number }>} */
const generationProgress = ref({
  percent: 0,
  activeStepIndex: -1,
  completedStepIndex: -1,
  label: '',
  activeHydrologySubstepIndex: -1,
  completedHydrologySubstepIndex: -1,
  skippedHydrologySubstepIds: [],
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
const hydrologyStats = computed(() =>
  createHydrologyStatsForDisplay(worldDocument.value?.generationReport),
)
const canReplay = computed(() => (worldDocument.value?.erosionSnapshots?.length ?? 0) > 0)
const generationStepStatuses = computed(() =>
  createGenerationStepStatuses(
    DERIVED_GEOGRAPHY_STEPS,
    generationProgress.value.activeStepIndex,
    generationProgress.value.completedStepIndex,
  ),
)
const hydrologySubstepStatuses = computed(() =>
  createHydrologySubstepStatuses(
    HYDROLOGY_SUBSTEPS,
    generationProgress.value.activeHydrologySubstepIndex,
    generationProgress.value.completedHydrologySubstepIndex,
    new Set(generationProgress.value.skippedHydrologySubstepIds),
  ),
)
const hydrologySubstepTimings = computed(() =>
  createHydrologySubstepTimingsForDisplay(worldDocument.value?.generationReport),
)

/**
 * @param {'pending' | 'active' | 'complete' | 'skipped'} status
 */
function stepStatusColor(status) {
  if (status === 'complete') return 'positive'
  if (status === 'active') return 'primary'
  if (status === 'skipped') return 'grey-6'
  return 'grey-8'
}

function resetGenerationProgress() {
  generationProgress.value = {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: '',
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds: [],
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
 * @param {number | boolean} value
 */
function onControlChange(key, value) {
  settingsStore.setControl(key, value)
  regenerate()
}

/**
 * @param {string} key
 * @param {number | boolean} value
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
      onStepStart({ stepIndex, stepCount, label, stepId }) {
        generationProgress.value = {
          percent: generationProgressValue(stepIndex, stepCount),
          activeStepIndex: stepIndex,
          completedStepIndex: generationProgress.value.completedStepIndex,
          label,
          activeHydrologySubstepIndex: -1,
          completedHydrologySubstepIndex: stepId === 'hydrology'
            ? -1
            : generationProgress.value.completedHydrologySubstepIndex,
          skippedHydrologySubstepIds: stepId === 'hydrology'
            ? []
            : generationProgress.value.skippedHydrologySubstepIds,
        }
      },
      onSubstepStart({ substepIndex }) {
        generationProgress.value = {
          ...generationProgress.value,
          activeHydrologySubstepIndex: substepIndex,
        }
      },
      onSubstepComplete({ substepIndex, substepId, skipped }) {
        generationProgress.value = {
          ...generationProgress.value,
          activeHydrologySubstepIndex: substepIndex,
          completedHydrologySubstepIndex: substepIndex,
          skippedHydrologySubstepIds: skipped
            ? [...generationProgress.value.skippedHydrologySubstepIds, substepId]
            : generationProgress.value.skippedHydrologySubstepIds,
        }
      },
      onStepComplete({ stepIndex, stepCount, label, stepId, worldDocument: doc }) {
        generationProgress.value = {
          percent: generationProgressValue(stepIndex, stepCount),
          activeStepIndex: stepIndex,
          completedStepIndex: stepIndex,
          label,
          activeHydrologySubstepIndex: -1,
          completedHydrologySubstepIndex: stepId === 'hydrology'
            ? -1
            : generationProgress.value.completedHydrologySubstepIndex,
          skippedHydrologySubstepIds: stepId === 'hydrology'
            ? []
            : generationProgress.value.skippedHydrologySubstepIds,
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

.hydrology-substep-row {
  flex: 0 0 100%;
  padding-left: 0.5rem;
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
