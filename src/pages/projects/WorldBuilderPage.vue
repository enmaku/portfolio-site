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
        />
      </div>
      <q-btn
        data-testid="world-builder-regenerate"
        color="primary"
        label="Regenerate"
        @click="regenerate"
      />
    </div>
    <div
      ref="mapHostRef"
      data-testid="world-builder-map-host"
      class="map-host col"
    />
  </q-page>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { generatePhysicalTerrainBaseline } from '@world-builder/core/generatePhysicalTerrainBaseline.js'
import {
  createControlsStateForSeed,
  createRandomGeographySeed,
  normalizeWindDegrees,
  parseGeographySeedInput,
} from '@world-builder/worldBuilderPageModel.js'

const mapHostRef = ref(null)
const seedInput = ref('0')
const prevailingWindDegrees = ref(0)

/** @type {import('@world-builder/core/types.js').WorldDocument | null} */
let worldDocument = null

/** @type {{ updateWorldDocument: (doc: import('@world-builder/core/types.js').WorldDocument) => void, destroy: () => void } | null} */
let mapViewport = null

/** @type {typeof import('@world-builder/renderer/createWorldBuilderMapViewport.js').createWorldBuilderMapViewport | null} */
let createWorldBuilderMapViewport = null

function regenerate() {
  const parsedSeed = parseGeographySeedInput(seedInput.value)
  if (parsedSeed === null) {
    return
  }

  worldDocument = generatePhysicalTerrainBaseline({
    geographySeed: parsedSeed,
    prevailingWindDegrees: normalizeWindDegrees(prevailingWindDegrees.value),
  })

  if (mapViewport) {
    mapViewport.updateWorldDocument(worldDocument)
    return
  }

  if (mapHostRef.value && createWorldBuilderMapViewport) {
    createWorldBuilderMapViewport(mapHostRef.value, worldDocument).then((viewport) => {
      mapViewport = viewport
    })
  }
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

.map-host {
  min-height: 0;
  overflow: hidden;
}
</style>
