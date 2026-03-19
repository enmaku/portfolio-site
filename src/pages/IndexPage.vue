<template>
  <q-page class="q-pa-md">
    <div v-if="photos.length" class="gallery-masonry">
      <div
        v-for="p in photos"
        :key="p.src"
        class="gallery-tile"
      >
        <q-img
          :src="p.src"
          :alt="p.label"
          class="gallery-thumb rounded-borders cursor-pointer"
          spinner-color="primary"
          fit="cover"
          @click="openPhoto(p)"
        />
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
      <q-card class="bg-black text-white column no-wrap">
        <q-bar>
          <div class="text-subtitle2 ellipsis" style="max-width: 70vw">
            {{ dialogLabel }}
          </div>
          <q-space />
          <q-btn flat dense icon="close" aria-label="Close" v-close-popup />
        </q-bar>
        <div class="dialog-image-wrap">
          <img :src="dialogSrc" :alt="dialogLabel" class="dialog-image" />
        </div>
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

<style scoped>
.gallery-masonry {
  column-count: 1;
  column-gap: 16px;
}

.gallery-tile {
  break-inside: avoid;
  margin-bottom: 16px;
}

.gallery-thumb {
  width: 100%;
}

.dialog-image-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
}

.dialog-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

@media (min-width: 600px) {
  .gallery-masonry {
    column-count: 2;
  }
}

@media (min-width: 1024px) {
  .gallery-masonry {
    column-count: 3;
  }
}

@media (min-width: 1440px) {
  .gallery-masonry {
    column-count: 4;
  }
}
</style>
