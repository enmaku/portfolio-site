<template>
  <q-icon
    class="prevailing-wind-arrow"
    name="navigation"
    color="primary"
    size="22px"
    aria-hidden="true"
    :style="{ transform: `rotate(${rotation}deg)` }"
  />
</template>

<script setup>
import { computed } from 'vue'
import { normalizeWindDegreesForDisplay } from '@world-builder/formatPrevailingWind.js'

const props = defineProps({
  degrees: {
    type: Number,
    required: true,
  },
})

const rotation = computed(() => normalizeWindDegreesForDisplay(props.degrees) + 180)
</script>

<style scoped>
.prevailing-wind-arrow {
  flex: 0 0 auto;
  transform-origin: center center;
}
</style>
