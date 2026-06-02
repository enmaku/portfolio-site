<template>
  <q-card flat bordered class="dungeon-stats-tile col full-width">
    <q-card-section class="column col">
      <div class="text-subtitle2 text-grey-5">{{ title }}</div>

      <div
        v-if="loading"
        class="q-mt-md col flex flex-center"
        data-testid="dungeon-stats-tile-loading"
      >
        <q-spinner color="primary" size="32px" />
      </div>

      <q-banner
        v-else-if="error"
        data-testid="dungeon-stats-tile-error"
        class="bg-grey-9 text-grey-3 q-mt-sm"
        dense
        rounded
      >
        Unable to load match statistics.
      </q-banner>

      <div v-else class="q-mt-sm col column" data-testid="dungeon-stats-tile-success">
        <slot />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  error: {
    type: Boolean,
    required: true,
  },
})
</script>

<style scoped>
.dungeon-stats-tile {
  min-height: 100%;
}
</style>
