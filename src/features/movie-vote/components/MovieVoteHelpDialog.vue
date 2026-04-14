<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card style="width: min(400px, 100vw - 32px)">
      <q-card-section class="q-pb-sm">
        <div class="text-h6">Help &amp; about</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="text-body2">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noreferrer"
          class="text-primary"
          style="text-decoration: none"
          >This product uses the TMDB API but is not endorsed or certified by TMDB.</a
        >
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>
