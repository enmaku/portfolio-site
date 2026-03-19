<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h4">Photography</div>

      <q-space />

      <q-btn
        color="primary"
        icon="open_in_new"
        label="View on Google Photos"
        :href="googlePhotosUrl"
        target="_blank"
        rel="noreferrer"
        no-caps
        class="gt-sm"
      />
    </div>

    <div v-if="photos.length" class="row q-col-gutter-md">
      <div
        v-for="p in photos"
        :key="p.src"
        class="col-6 col-sm-4 col-md-3"
      >
        <q-img
          :src="p.src"
          :alt="p.label"
          :ratio="1"
          class="rounded-borders cursor-pointer"
          spinner-color="primary"
          @click="openPhoto(p)"
        >
          <div class="absolute-bottom text-caption bg-black bg-opacity-60 text-white q-pa-sm ellipsis">
            {{ p.label }}
          </div>
        </q-img>
      </div>
    </div>

    <div v-else>
      <q-card class="q-pa-lg" flat bordered>
        <div class="text-h6">No local photos yet</div>
        <div class="text-body2 text-grey q-mt-sm">
          Add images to <code>src/assets/photos/</code> (JPG/PNG/WebP). They will appear in this gallery automatically.
        </div>

        <q-separator class="q-my-md" />

        <div class="row items-center q-col-gutter-md">
          <q-btn
            color="primary"
            icon="photo"
            label="Open Google Photos album"
            :href="googlePhotosUrl"
            target="_blank"
            rel="noreferrer"
            no-caps
          />
        </div>
      </q-card>

      <div class="q-mt-lg">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Preview</div>
            <div class="text-body2 text-grey q-mt-xs">
              If the embed doesn’t load, use the button above.
            </div>
          </q-card-section>

          <q-card-section class="q-pa-none">
            <iframe
              :src="googlePhotosUrl"
              loading="lazy"
              style="width: 100%; height: 70vh; border: 0;"
              referrerpolicy="no-referrer"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="dialogOpen" maximized>
      <q-card class="bg-black text-white">
        <q-bar>
          <div class="text-subtitle2 ellipsis" style="max-width: 70vw">
            {{ dialogLabel }}
          </div>
          <q-space />
          <q-btn flat dense icon="close" aria-label="Close" v-close-popup />
        </q-bar>
        <q-img :src="dialogSrc" style="max-height: 90vh" contain />
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'

const googlePhotosUrl = 'https://photos.app.goo.gl/pjuSWsZbgcp3eC7o6'

// Vite will build these images into your bundle.
// Add your photos to `src/assets/photos/` and they will show up here.
const photoModules = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const photos = computed(() => {
  return Object.entries(photoModules)
    .map(([path, src]) => {
      const file = path.split('/').pop() || ''
      const label = file.replace(/\.[^.]+$/, '')
      return { src, label }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
})

const dialogOpen = ref(false)
const dialogSrc = ref('')
const dialogLabel = ref('')

function openPhoto(photo) {
  dialogSrc.value = photo.src
  dialogLabel.value = photo.label
  dialogOpen.value = true
}
</script>
