<template>
  <q-page class="world-builder-page column fit no-wrap">
    <div
      v-if="showGenerationProgress || showResourceOverlayBar"
      data-testid="world-builder-status-bar"
      class="generation-progress"
    >
      <q-separator />
      <div class="q-px-sm status-bar-content">
        <div
          v-if="showGenerationProgress"
          data-testid="world-builder-generation-progress"
          class="status-bar-panel status-bar-panel--generation"
        >
          <q-linear-progress
            :value="generationProgress.percent / 100"
            color="primary"
            track-color="grey-9"
            rounded
          />
          <div class="row q-gutter-xs items-center no-wrap generation-step-row">
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
              <template v-if="step.id === 'hydrology' && step.status === 'active'">
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
              </template>
            </template>
          </div>
        </div>
        <div
          v-else-if="showResourceOverlayBar"
          data-testid="world-builder-resource-overlay-bar"
          class="status-bar-panel status-bar-panel--overlays resource-overlay-row"
        >
          <q-checkbox
            v-for="overlay in resourceOverlayDefinitions"
            :key="overlay.id"
            dense
            :model-value="resourceOverlayVisibility[overlay.id]"
            :data-testid="`world-builder-overlay-toggle-${overlay.id}`"
            :label="overlay.label"
            @update:model-value="(value) => onResourceOverlayToggle(overlay.id, value)"
          />
        </div>
      </div>
      <q-separator />
    </div>
    <div class="row col map-row">
      <aside
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
            class="q-mb-md"
            min="0"
            @change="onSeedCommit"
            @keyup.enter="onSeedCommit"
          >
            <template #label>
              <span class="row items-center no-wrap q-gutter-xs">
                Geography seed
                <WorldBuilderSettingHelp
                  :text="GEOGRAPHY_SEED_TOOLTIP"
                  label="Geography seed"
                />
              </span>
            </template>
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
          <q-list
            dense
            class="generation-controls-sections"
          >
            <q-expansion-item
              v-for="section in controlSections"
              :key="section.section"
              :label="section.section"
              dense
              header-class="text-caption text-weight-medium"
            >
              <div
                v-for="control in section.controls"
                :key="control.key"
                class="generation-control q-mb-md"
              >
                <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
                  <span class="text-caption">
                    {{ control.label }}:
                    {{ formatControlValue(control.key, controlValue(control.key)) }}
                  </span>
                  <WorldBuilderSettingHelp
                    :text="control.tooltip"
                    :label="control.label"
                  />
                </div>
                <q-toggle
                  v-if="control.kind === 'toggle'"
                  :model-value="Boolean(controlValue(control.key))"
                  :data-testid="control.testId"
                  color="primary"
                  @update:model-value="onToggleChange(control.key, $event)"
                />
                <q-slider
                  v-else-if="control.key !== 'prevailingWindDegrees'"
                  class="generation-control__slider full-width"
                  dense
                  :model-value="controlValue(control.key)"
                  :data-testid="control.testId"
                  :min="control.min"
                  :max="control.max"
                  :step="control.step"
                  label
                  color="primary"
                  @update:model-value="onSliderInput(control.key, $event)"
                  @change="onSliderCommit(control.key, $event)"
                />
                <div
                  v-else
                  class="row items-center no-wrap q-gutter-xs"
                >
                  <q-slider
                    class="col generation-control__slider"
                    dense
                    :model-value="controlValue(control.key)"
                    :data-testid="control.testId"
                    :min="control.min"
                    :max="control.max"
                    :step="control.step"
                    label
                    color="primary"
                    @update:model-value="onSliderInput(control.key, $event)"
                    @change="onSliderCommit(control.key, $event)"
                  />
                  <PrevailingWindArrow
                    data-testid="world-builder-wind-arrow"
                    :degrees="controlValue(control.key)"
                  />
                </div>
              </div>
            </q-expansion-item>
            <q-expansion-item
              label="Map overlays"
              dense
              header-class="text-caption text-weight-medium"
            >
              <div
                v-for="control in overlayControlDefinitions"
                :key="control.key"
                class="generation-control q-mb-md"
              >
                <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
                  <span class="text-caption">
                    {{ control.label }}:
                    {{ formatOverlayControlValue(control.key, overlayDisplaySetting(control.key)) }}
                  </span>
                  <WorldBuilderSettingHelp
                    :text="control.tooltip"
                    :label="control.label"
                  />
                </div>
                <q-slider
                  class="generation-control__slider full-width"
                  dense
                  :model-value="overlayDisplaySetting(control.key)"
                  :data-testid="control.testId"
                  :min="control.min"
                  :max="control.max"
                  :step="control.step"
                  label
                  color="primary"
                  @update:model-value="onOverlaySliderChange(control.key, $event)"
                />
              </div>
            </q-expansion-item>
          </q-list>
        </div>
        <div class="generation-controls-footer">
          <q-btn
            data-testid="world-builder-regenerate"
            class="generation-controls-footer__btn"
            color="primary"
            label="Regenerate"
            unelevated
            square
            :loading="isGenerating"
            @click="regenerate"
          />
        </div>
      </aside>
      <div
        ref="mapHostRef"
        data-testid="world-builder-map-host"
        class="map-host col"
      />
      <aside
        data-testid="world-builder-generation-report"
        class="generation-report-panel bg-grey-10"
      >
        <div class="panel-scroll q-pa-md">
          <q-list
            bordered
            separator
            class="q-mb-md"
          >
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
        </div>
      </aside>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'
import {
  DERIVED_GEOGRAPHY_STEPS,
  HYDROLOGY_SUBSTEPS,
  runDerivedGeographyInWorker,
} from '@world-builder/runDerivedGeographyInWorker.js'
import {
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
  GEOGRAPHY_SEED_TOOLTIP,
  formatGenerationControlValue,
} from '@world-builder/worldBuilderGenerationControls.js'
import {
  WORLD_BUILDER_OVERLAY_CONTROL_DEFINITIONS,
  formatOverlayControlValue,
} from '@world-builder/worldBuilderOverlayControls.js'
import {
  createResourceOverlayDefinitions,
} from '@world-builder/resourceOverlays.js'
import {
  createResourceOverlayPageState,
  resetResourceOverlayVisibilityState,
  syncResourceOverlayStateToViewport,
  toggleResourceOverlayVisibility,
  updateOverlayDisplaySetting,
} from '@world-builder/resourceOverlayState.js'
import {
  createGenerationRunController,
  createInitialGenerationProgress,
  startDerivedGeographyGeneration,
} from '@world-builder/worldBuilderGenerationOrchestrator.js'
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
  parseGeographySeedInput,
  shouldShowGenerationProgress,
  shouldShowResourceOverlayBar,
  validationStatusColor,
  validationStatusIcon,
} from '@world-builder/worldBuilderPageModel.js'
import { useWorldBuilderSettingsStore } from '../../stores/worldBuilderSettings.js'
import PrevailingWindArrow from '../../components/world-builder/PrevailingWindArrow.vue'
import WorldBuilderSettingHelp from '../../components/world-builder/WorldBuilderSettingHelp.vue'

const $q = useQuasar()
const settingsStore = useWorldBuilderSettingsStore()
const { prevailingWindDegrees, generationOptions, overlayDisplaySettings } = storeToRefs(settingsStore)

const mapHostRef = ref(null)
const seedInput = ref('0')
const isGenerating = ref(false)
const pipelineSucceeded = ref(false)
const controlSections = WORLD_BUILDER_GENERATION_CONTROL_SECTIONS
const overlayControlDefinitions = WORLD_BUILDER_OVERLAY_CONTROL_DEFINITIONS
const resourceOverlayDefinitions = createResourceOverlayDefinitions()

/** @type {import('vue').Ref<import('@world-builder/resourceOverlayState.js').ResourceOverlayPageState>} */
const resourceOverlayState = ref(createResourceOverlayPageState(overlayDisplaySettings.value))

const resourceOverlayVisibility = computed(() => resourceOverlayState.value.visibility)

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

/** @type {{ updateWorldDocument: Function, focusOn: Function, playErosionSnapshots: Function, setResourceOverlayVisibility: Function, destroy: Function } | null} */
let mapViewport = null

/** @type {typeof import('@world-builder/renderer/createWorldBuilderMapViewport.js').createWorldBuilderMapViewport | null} */
let createWorldBuilderMapViewport = null

/** @type {ReturnType<typeof createGenerationRunController> | null} */
let generationRunController = null

const validationRows = computed(() =>
  createValidationRowsForDisplay(worldDocument.value?.generationReport),
)
const stageSummary = computed(() =>
  createStageSummaryForDisplay(worldDocument.value?.generationReport),
)
const hydrologyStats = computed(() =>
  createHydrologyStatsForDisplay(worldDocument.value?.generationReport),
)
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
const showGenerationProgress = computed(() => shouldShowGenerationProgress(isGenerating.value))
const showResourceOverlayBar = computed(() =>
  shouldShowResourceOverlayBar(isGenerating.value, pipelineSucceeded.value),
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
  generationProgress.value = createInitialGenerationProgress()
}

function resetResourceOverlayVisibility() {
  resourceOverlayState.value = resetResourceOverlayVisibilityState(resourceOverlayState.value)
  syncResourceOverlayVisibilityToMapViewport()
}

function syncResourceOverlayVisibilityToMapViewport() {
  if (!mapViewport) return
  syncResourceOverlayStateToViewport(mapViewport, resourceOverlayState.value)
}

/**
 * @param {string} resourceId
 * @param {boolean} visible
 */
function onResourceOverlayToggle(resourceId, visible) {
  resourceOverlayState.value = toggleResourceOverlayVisibility(
    resourceOverlayState.value,
    resourceId,
    visible,
  )
  mapViewport?.setResourceOverlayVisibility(resourceId, visible)
}

/**
 * @param {'arableMinimumProductivity'} key
 */
function overlayDisplaySetting(key) {
  return overlayDisplaySettings.value[key]
}

/**
 * @param {'arableMinimumProductivity'} key
 * @param {number} value
 */
function onOverlaySliderChange(key, value) {
  settingsStore.setOverlayDisplaySetting(key, value)
  resourceOverlayState.value = updateOverlayDisplaySetting(resourceOverlayState.value, key, value)
  syncResourceOverlayVisibilityToMapViewport()
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
function onToggleChange(key, value) {
  settingsStore.setControl(key, value)
  regenerate()
}

/**
 * @param {string} key
 * @param {number | boolean} value
 */
function onSliderInput(key, value) {
  settingsStore.setControl(key, value)
}

/**
 * @param {string} key
 * @param {number | boolean} value
 */
function onSliderCommit(key, value) {
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
    syncResourceOverlayVisibilityToMapViewport()
  }
}

/**
 * @param {unknown} error
 */
function showGenerationFailure(error) {
  generationRunController?.invalidateRuns()
  isGenerating.value = false
  pipelineSucceeded.value = false
  const message = error instanceof Error ? error.message : String(error)
  $q.notify({
    type: 'negative',
    message: `World generation failed: ${message}`,
    timeout: 0,
    actions: [{ label: 'Dismiss', color: 'white' }],
  })
}

function regenerate() {
  const parsedSeed = parseGeographySeedInput(seedInput.value)
  if (parsedSeed === null) {
    return
  }

  if (!generationRunController) {
    generationRunController = createGenerationRunController()
  }

  isGenerating.value = true
  pipelineSucceeded.value = false
  resetGenerationProgress()
  resetResourceOverlayVisibility()

  startDerivedGeographyGeneration({
    controller: generationRunController,
    params: buildDerivedGeographyParams(
      parsedSeed,
      prevailingWindDegrees.value,
      generationOptions.value,
    ),
    runDerivedGeographyInWorker,
    handlers: {
      onRunStarted({ progress }) {
        generationProgress.value = progress
      },
      onProgress(progress) {
        generationProgress.value = progress
      },
      onWorldDocument(doc) {
        void applyWorldDocumentToMap(doc).catch((error) => {
          showGenerationFailure(error)
        })
      },
      onComplete() {
        isGenerating.value = false
        pipelineSucceeded.value = true
        resetResourceOverlayVisibility()
      },
      onCancelled() {
        isGenerating.value = false
        pipelineSucceeded.value = false
        resetGenerationProgress()
      },
      onError(message) {
        showGenerationFailure(message)
      },
    },
  })
}

/**
 * @param {{ mapFocus?: import('@world-builder/core/types.js').MapFocus }} row
 */
function onValidationRowClick(row) {
  if (!row.mapFocus || !mapViewport) return
  mapViewport.focusOn(row.mapFocus)
}

function onSeedCommit() {
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
  resourceOverlayState.value = createResourceOverlayPageState(overlayDisplaySettings.value)
  syncResourceOverlayVisibilityToMapViewport()
  regenerate()
}

onMounted(async () => {
  settingsStore.ensureInitialized()
  seedInput.value = String(settingsStore.geographySeed)
  resourceOverlayState.value = createResourceOverlayPageState(overlayDisplaySettings.value)

  const rendererModule = await import('@world-builder/renderer/createWorldBuilderMapViewport.js')
  createWorldBuilderMapViewport = rendererModule.createWorldBuilderMapViewport
  generationRunController = createGenerationRunController()
  regenerate()
})

onUnmounted(() => {
  generationRunController?.cancelActive()
  generationRunController = null
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

.generation-progress {
  flex: 0 0 auto;
}

.status-bar-content {
  display: flex;
  align-items: center;
  height: 40px;
  flex: 0 0 40px;
  overflow: hidden;
}

.status-bar-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.status-bar-panel--generation {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.status-bar-panel--overlays {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow-x: hidden;
}

.generation-step-row {
  overflow-x: hidden;
  height: 28px;
  flex: 0 0 28px;
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

.generation-controls-footer {
  flex: 0 0 48px;
  height: 48px;
  padding: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.generation-controls-footer__btn {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
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

.generation-controls-sections :deep(.q-expansion-item__content) {
  padding: 0 16px 4px;
}

.generation-control {
  padding-left: 8px;
}

.generation-control__slider {
  padding: 0 4px;
}
</style>
